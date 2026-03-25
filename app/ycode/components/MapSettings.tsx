'use client';

/**
 * Map Settings Component
 *
 * Settings panel for map layers (Mapbox-powered).
 * Controls coordinates, zoom, style, marker visibility, and interactivity.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import SettingsPanel from './SettingsPanel';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { MAP_STYLE_OPTIONS, DEFAULT_MAP_SETTINGS } from '@/lib/map-utils';
import { useDebounce } from '@/hooks/use-debounce';
import type { Layer, MapSettings as MapSettingsType, MapStyle } from '@/types';

type SearchResult = { place_name: string; center: [number, number] };

const ZOOM_MIN = 1;
const ZOOM_MAX = 22;
const ZOOM_STEP = 0.5;

interface MapSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function MapSettings({ layer, onLayerUpdate }: MapSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const mapSettings = layer?.settings?.map || DEFAULT_MAP_SETTINGS;
  const hasToken = !!useSettingsStore((s) => s.getSettingByKey('mapbox_access_token'));

  // Local input state for lat/lng/zoom to allow free typing
  const [latInput, setLatInput] = useState(String(mapSettings.latitude));
  const [lngInput, setLngInput] = useState(String(mapSettings.longitude));
  const [zoomInput, setZoomInput] = useState(String(mapSettings.zoom));

  const [addressQuery, setAddressQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(addressQuery, 400);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Sync local inputs when layer selection changes
  useEffect(() => {
    setLatInput(String(mapSettings.latitude));
    setLngInput(String(mapSettings.longitude));
    setZoomInput(String(mapSettings.zoom));
  }, [layer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMapSettings = useCallback(
    (updates: Partial<MapSettingsType>) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          map: {
            ...mapSettings,
            ...updates,
          },
        },
      });
    },
    [layer, mapSettings, onLayerUpdate]
  );

  const handleLatChange = useCallback(
    (value: string) => {
      setLatInput(value);
      const num = parseFloat(value);
      if (!isNaN(num) && num >= -90 && num <= 90) {
        updateMapSettings({ latitude: num });
      }
    },
    [updateMapSettings]
  );

  const handleLngChange = useCallback(
    (value: string) => {
      setLngInput(value);
      const num = parseFloat(value);
      if (!isNaN(num) && num >= -180 && num <= 180) {
        updateMapSettings({ longitude: num });
      }
    },
    [updateMapSettings]
  );

  const handleZoomChange = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, num));
        setZoomInput(String(clamped));
        updateMapSettings({ zoom: clamped });
      }
    },
    [updateMapSettings]
  );

  const handleSliderZoomChange = useCallback(
    (values: number[]) => {
      const zoom = values[0];
      setZoomInput(String(zoom));
      updateMapSettings({ zoom });
    },
    [updateMapSettings]
  );

  // Geocoding search via API route
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    fetch(`/ycode/api/maps/geocode?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setSearchResults(json.data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setSearchResults([]);
        }
      })
      .finally(() => setIsSearching(false));
  }, [debouncedQuery]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const [lng, lat] = result.center;
      setLatInput(String(lat));
      setLngInput(String(lng));
      setAddressQuery('');
      setSearchResults([]);
      updateMapSettings({ latitude: lat, longitude: lng });
    },
    [updateMapSettings]
  );

  if (!layer || layer.name !== 'map') {
    return null;
  }

  return (
    <SettingsPanel
      title="Map"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        {!hasToken && (
          <Link
            href="/ycode/integrations/apps?app=mapbox"
            className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive block"
          >
            Mapbox token not configured.
          </Link>
        )}

        {/* Address search */}
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="pt-2">Address</Label>
          <div className="col-span-2 flex flex-col gap-1">
            <div className="relative">
              <Input
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                placeholder="Search for an address..."
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ...
                </div>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md bg-popover max-h-40 overflow-y-auto">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent truncate"
                    onClick={() => handleSelectResult(result)}
                  >
                    {result.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Lat. / Long.</Label>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <Input
              value={latInput}
              onChange={(e) => handleLatChange(e.target.value)}
              placeholder="40.7128"
            />
            <Input
              value={lngInput}
              onChange={(e) => handleLngChange(e.target.value)}
              placeholder="-74.0060"
            />
          </div>
        </div>

        {/* Zoom */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Zoom</Label>
          <div className="col-span-2 flex items-center gap-2">
            <Slider
              value={[mapSettings.zoom]}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              onValueChange={handleSliderZoomChange}
              className="flex-1 min-w-0"
            />
            <div className="w-14 shrink-0">
              <Input
                stepper
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={zoomInput}
                onChange={(e) => handleZoomChange(e.target.value)}
                className="pr-5!"
              />
            </div>
          </div>
        </div>

        {/* Style */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Style</Label>
          <div className="col-span-2">
            <Select
              value={mapSettings.style}
              onValueChange={(value: MapStyle) =>
                updateMapSettings({ style: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_STYLE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Behavior */}
        <div className="grid grid-cols-3 gap-2">
          <Label variant="muted">Behavior</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-marker"
                checked={mapSettings.showMarker}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ showMarker: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-marker"
                className="cursor-pointer"
              >
                Show marker
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-interactive"
                checked={mapSettings.interactive}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ interactive: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-interactive"
                className="cursor-pointer"
              >
                Interactive
              </Label>
            </div>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
