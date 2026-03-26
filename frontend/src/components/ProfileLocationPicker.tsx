import React, { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-geosearch/dist/geosearch.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { toast } from 'react-toastify'

interface ProfileLocationPickerProps {
  value?: { lat: number; lng: number };
  onChange: (coords: { lat: number; lng: number }, address: string) => void;
}

const ProfileLocationPicker: React.FC<ProfileLocationPickerProps> = ({ value, onChange }) => {
  const [position, setPosition] = useState(value || { lat: 28.6139, lng: 77.2090 }); // Default to New Delhi
  const [address, setAddress] = useState('');

  const customIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.imagePath = '';
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  }, []);

  const RecenterOnPosition: React.FC<{ pos: { lat: number; lng: number } }> = ({ pos }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(pos, map.getZoom());
    }, [map, pos]);
    return null;
  };



  const MapEvents = () => {
    useMapEvents({
      click: (e) => {
      },
    });
    return null;
  };

  const SearchControl = () => {
    const map = useMap();
    const provider = new OpenStreetMapProvider();

    useEffect(() => {
      const searchControl = new (GeoSearchControl as any)({
        provider: provider,
        showMarker: false, // Don't use search provider's marker
        showPopup: false,
        autoClose: true,
        retainZoom: true,   // Keep zoom level to avoid animations
        animateZoom: false, // Disable zoom animations to prevent TypeError
        keepResult: true,
        searchLabel: 'Enter address or location',
      });

      map.addControl(searchControl);

      // Listen for search result and update marker position
      map.on('geosearch/showlocation', (result: any) => {
        if (result && result.location) {
          const { x, y, label } = result.location;
          const newPos = { lat: y, lng: x };
          setPosition(newPos);
          setAddress(label);
          onChange(newPos, label);
        }
      });

      return () => {
        map.off('geosearch/showlocation');
        try {
          if (map && (map as any)._container) {
            map.removeControl(searchControl);
          }
        } catch (e) {
          console.warn('Failed to remove search control safely:', e);
        }
      };
    }, [map]);

    return null;
  };

  const fetchAddress = useCallback(async (latlng: { lat: number; lng: number }) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
      const data = await response.json();
      if (data.display_name) {
        setAddress(data.display_name);
        onChange(latlng, data.display_name);
      } else {
        setAddress('Unknown location');
        onChange(latlng, 'Unknown location');
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      setAddress('Error fetching address');
      onChange(latlng, 'Error fetching address');
      toast.error('Failed to fetch address for the selected location.');
    }
  }, [onChange]);

  useEffect(() => {
    if (value) {
      setPosition(value);
      fetchAddress(value);
    }
  }, [value, fetchAddress]);

  useEffect(() => {
    if (!value && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(latlng);
          fetchAddress(latlng);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [value, fetchAddress]);

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOnPosition pos={position} />
        <MapEvents />
        <SearchControl />
        {position && (
          <Marker
            position={position}
            draggable={true}
            icon={customIcon}
            eventHandlers={{
              dragend: (e) => {
                const newPos = e.target.getLatLng();
                setPosition(newPos);
                fetchAddress(newPos);
              },
            }}
          />
        )}
      </MapContainer>
      {address && (
        <div className="mt-2 p-2 bg-surface rounded-md text-sm text-textSecondary">
          Selected Location: <strong>{address}</strong>
        </div>
      )}
    </div>
  );
};

export default ProfileLocationPicker;
