/// <reference types="@types/google.maps" />
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MapPin, Mic, Loader2, MapPinned, LocateFixed, Navigation
} from 'lucide-react';
import { formatAddressAI, reverseGeocode } from '../src/services/geminiService';
import { hapticTap } from '../src/hooks/useHaptic';

// Extend Window interface for Google callback
declare global {
  interface Window {
    google?: typeof google;
    initGooglePlacesCallback?: () => void;
  }
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  isListening?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

// Track if Google Places script is loaded
let googlePlacesLoaded = false;
let googlePlacesLoading = false;
const loadCallbacks: (() => void)[] = [];

const loadGooglePlaces = (apiKey: string): Promise<void> => {
  return new Promise((resolve) => {
    // Check if already fully loaded
    if (googlePlacesLoaded && window.google?.maps?.places?.AutocompleteService) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (googlePlacesLoading) {
      return;
    }

    googlePlacesLoading = true;

    // Define the callback that Google will call when ready
    (window as any).initGooglePlacesCallback = () => {
      googlePlacesLoaded = true;
      googlePlacesLoading = false;
      loadCallbacks.forEach(cb => cb());
      loadCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlacesCallback`;
    script.async = true;
    script.onerror = () => {
      googlePlacesLoading = false;
      console.error('Failed to load Google Places API');
    };
    document.head.appendChild(script);
  });
};

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Start typing address or postcode...",
  className = "",
  onVoiceStart,
  onVoiceEnd,
  isListening = false,
  disabled = false,
  showLabel = true,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{description: string, placeId: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Places API
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      console.warn('Google Places API key not configured. Using fallback mode.');
      return;
    }

    loadGooglePlaces(apiKey).then(() => {
      setPlacesReady(true);
    });
  }, []);

  // Initialize services when ready
  useEffect(() => {
    if (!placesReady) return;

    try {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      // Create a dummy div for PlacesService (required but not displayed)
      const dummyDiv = document.createElement('div');
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    } catch (err) {
      console.error('Failed to initialize Google Places services:', err);
    }
  }, [placesReady]);

  // Handle search with debounce
  const searchPlaces = useCallback((query: string) => {
    // Trigger search after just 1 character to support UK addresses with 1-2 digit house numbers
    if (!autocompleteServiceRef.current || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'gb' },
        types: ['address'],
      },
      (predictions: google.maps.places.AutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(
            predictions.map((p: google.maps.places.AutocompletePrediction) => ({
              description: p.description,
              placeId: p.place_id,
            }))
          );
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    );
  }, []);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback((placeId: string, description: string) => {
    hapticTap();
    onChange(description);
    setSuggestions([]);
    setShowSuggestions(false);
  }, [onChange]);

  // Handle input change with debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(newValue);
    }, 300);
  }, [onChange, searchPlaces]);

  // Handle GPS location
  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    hapticTap();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            onChange(address);
          } else {
            alert("Could not determine address from your location.");
          }
        } catch (err) {
          alert("Failed to geocode your location.");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        alert("Location access denied or unavailable.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onChange]);

  // Handle AI verification
  const handleVerifyAddress = useCallback(async () => {
    if (!value.trim()) return;

    setIsVerifying(true);
    hapticTap();

    try {
      const formatted = await formatAddressAI(value);
      onChange(formatted);
    } catch (err) {
      console.error('Address verification failed:', err);
    } finally {
      setIsVerifying(false);
    }
  }, [value, onChange]);

  // Open in Google Maps
  const openInMaps = useCallback(() => {
    if (!value.trim()) return;
    hapticTap();
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, [value]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`${showLabel ? 'space-y-0.5' : ''} relative`}>
      {showLabel && (
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 italic px-1">
          <MapPin size={10} className="md:w-3 md:h-3" /> Address
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2.5 md:px-4 md:py-4 md:pr-44 text-slate-950 font-bold text-sm md:text-base placeholder:text-xs md:placeholder:text-sm outline-none focus:bg-white focus:border-teal-500 transition-all ${className}`}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 1 && suggestions.length > 0 && setShowSuggestions(true)}
          disabled={disabled}
          autoComplete="off"
        />

        {/* Action buttons - hidden on mobile, shown inside input on desktop */}
        <div className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 gap-0.5 z-10">
          {/* Voice input button */}
          {onVoiceStart && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                if (isListening) {
                  onVoiceEnd?.();
                } else {
                  onVoiceStart();
                }
              }}
              className={`p-2 rounded-lg transition-all ${
                isListening
                  ? 'bg-red-500 text-white'
                  : 'text-slate-300 hover:text-teal-500 bg-transparent'
              }`}
              title="Voice input"
            >
              <Mic size={18} />
            </button>
          )}

          {/* GPS location button */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="p-2 rounded-lg transition-all text-blue-500 hover:text-blue-700 disabled:opacity-30 bg-transparent"
            title="Use current location"
          >
            {isLocating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LocateFixed size={18} />
            )}
          </button>

          {/* AI verify button */}
          <button
            type="button"
            onClick={handleVerifyAddress}
            disabled={!value.trim() || isVerifying}
            className="p-2 rounded-lg transition-all text-amber-500 hover:text-amber-700 disabled:opacity-30 bg-transparent"
            title="AI verify & format address"
          >
            {isVerifying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <MapPinned size={18} />
            )}
          </button>

          {/* Open in Maps button */}
          <button
            type="button"
            onClick={openInMaps}
            disabled={!value.trim()}
            className="p-2 rounded-lg transition-all text-green-600 hover:text-green-700 disabled:opacity-30 bg-transparent"
            title="Open in Google Maps"
          >
            <Navigation size={18} />
          </button>
        </div>
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion.placeId, suggestion.description)}
                className="w-full text-left px-4 py-3 hover:bg-amber-50 text-sm font-bold text-slate-900 border-b border-slate-50 last:border-0 flex items-center gap-3 transition-colors"
              >
                <MapPin size={14} className="text-amber-500 shrink-0" />
                <span className="truncate">{suggestion.description}</span>
              </button>
            ))}
            <div className="px-4 py-2 bg-slate-50 text-[9px] text-slate-400 text-right">
              Powered by Google
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-slate-100 rounded-2xl shadow-lg p-4 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-amber-500 mr-2" />
            <span className="text-sm text-slate-500">Searching...</span>
          </div>
        )}
      </div>

      {/* Action buttons - shown below input on mobile only */}
      <div className="flex md:hidden justify-end gap-1 mt-1.5">
        {/* Voice input button */}
        {onVoiceStart && (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              if (isListening) {
                onVoiceEnd?.();
              } else {
                onVoiceStart();
              }
            }}
            className={`p-1.5 rounded-lg transition-all ${
              isListening
                ? 'bg-red-500 text-white'
                : 'text-slate-400 hover:text-teal-500 bg-slate-100'
            }`}
            title="Voice input"
          >
            <Mic size={14} />
          </button>
        )}

        {/* GPS location button */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="p-1.5 rounded-lg transition-all text-blue-500 hover:text-blue-700 disabled:opacity-30 bg-slate-100"
          title="Use current location"
        >
          {isLocating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <LocateFixed size={14} />
          )}
        </button>

        {/* AI verify button */}
        <button
          type="button"
          onClick={handleVerifyAddress}
          disabled={!value.trim() || isVerifying}
          className="p-1.5 rounded-lg transition-all text-amber-500 hover:text-amber-700 disabled:opacity-30 bg-slate-100"
          title="AI verify & format address"
        >
          {isVerifying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MapPinned size={14} />
          )}
        </button>

        {/* Open in Maps button */}
        <button
          type="button"
          onClick={openInMaps}
          disabled={!value.trim()}
          className="p-1.5 rounded-lg transition-all text-green-600 hover:text-green-700 disabled:opacity-30 bg-slate-100"
          title="Open in Google Maps"
        >
          <Navigation size={14} />
        </button>
      </div>
    </div>
  );
};

export default AddressAutocomplete;
