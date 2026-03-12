import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { motion } from 'framer-motion'
import { FiCalendar, FiClock, FiUsers, FiDollarSign, FiMapPin, FiMap } from 'react-icons/fi'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-geosearch/dist/geosearch.css'
// ...existing code...
import { api } from '../lib/api'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const schema = yup.object({
  title: yup.string().required('Title is required').min(5, 'Min 5 characters').max(100, 'Max 100 characters'),
  description: yup.string().max(500, 'Max 500 characters'),
  sport: yup.string().required('Sport is required'),
  skillLevel: yup.string().required('Skill level is required'),
  startTime: yup.string().required('Start time is required')
    .test('future', 'Start time must be in the future', (v) => !v || new Date(v) > new Date()),
  durationMinutes: yup.number().min(30, 'Min 30 minutes').required(),
  totalSlots: yup.number().min(2, 'At least 2 players').max(50, 'Max 50 players').required(),
  alreadyConfirmed: yup.number().min(1, 'At least 1 (you)').max(49, 'Must be less than max players').default(1),
  availableSlots: yup.number().min(0),
  costPerPerson: yup.number().min(0),
  locationAddress: yup.string(),
  locationCity: yup.string().required('City is required'),
  locationLat: yup.number(),
  locationLng: yup.number(),
  notes: yup.string(),
  equipmentProvided: yup.boolean(),
  equipmentDetails: yup.string(),
  isPublic: yup.boolean(),
  ratingRequired: yup.boolean(),
  minRating: yup.number().min(0).max(5),
})

type FormData = yup.InferType<typeof schema>

const SPORTS = ['Football', 'Basketball', 'Tennis', 'Badminton', 'Cricket', 'Running', 'Volleyball', 'Table Tennis', 'Swimming', 'Cycling', 'Yoga', 'Other']

export default function CreateGame() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { register, setValue, watch, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: yupResolver(schema), defaultValues: { alreadyConfirmed: 1 } })
  const [showMap, setShowMap] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [address, setAddress] = useState('')

  // Watch fields for live "Open Spots" computation
  const watchTotal = watch('totalSlots')
  const watchConfirmed = watch('alreadyConfirmed')
  const openSpots = (watchTotal && watchConfirmed) ? Math.max(0, watchTotal - watchConfirmed) : null

  // Try to get GPS location
  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setShowMap(true)
      }, () => toast.error('Unable to get GPS location'))
    } else {
      toast.error('Geolocation not supported')
    }
  }

  // When user picks location on map
  const handleMapSelect = (latlng: { lat: number; lng: number }, addr: string) => {
    setCoords(latlng)
    setAddress(addr)
    setValue('locationLat', latlng.lat)
    setValue('locationLng', latlng.lng)
    setValue('locationAddress', addr)
    setShowMap(false)
  }

  // Inline LocationPicker logic
  function InlineLocationPicker({ value, onChange }: { value?: { lat: number; lng: number }, onChange: (coords: { lat: number; lng: number }, address: string) => void }) {
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(value || null)
    const provider = new OpenStreetMapProvider()

    const SearchControlComp = () => {
      const map = useMap()
      React.useEffect(() => {
        // @ts-ignore
        const searchControl = new (GeoSearchControl as any)({
          provider,
          style: 'bar',
          showMarker: true,
          showPopup: false,
          autoClose: true,
          retainZoomLevel: false,
          animateZoom: true,
          keepResult: true,
          searchLabel: 'Enter address',
        })
        map.addControl(searchControl)
        return () => { void map.removeControl(searchControl) }
      }, [map])
      return null
    }

    function LocationMarker() {
      useMapEvents({
        click(e: any) {
          setPosition(e.latlng)
          provider.search({ query: `${e.latlng.lat},${e.latlng.lng}` }).then((results: any[]) => {
            const address = results[0]?.label || ''
            onChange(e.latlng, address)
          })
        }
      })
      return position === null ? null : (
        <Marker
          position={position}
          interactive
          draggable={true}
          eventHandlers={{
            dragend: (e: any) => {
              const marker = e.target
              const latlng = marker.getLatLng()
              setPosition(latlng)
              provider.search({ query: `${latlng.lat},${latlng.lng}` }).then((results: any[]) => {
                const address = results[0]?.label || ''
                onChange(latlng, address)
              })
            }
          }}
        />
      )
    }

    // Fix marker icon issue in Leaflet
    React.useEffect(() => {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.imagePath = ''
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
      })
    }, [])

    return (
      <MapContainer
        center={value || { lat: 12.9716, lng: 77.5946 }}
        zoom={13}
        style={{ height: 400, width: '100%' }}
      >
        <TileLayer
          // @ts-ignore
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SearchControlComp />
        <LocationMarker />
      </MapContainer>
    )
  }

  const onSubmit = async (data: FormData) => {
    if (!isAuthenticated) {
      toast.info('Please sign in to create a game')
      navigate('/login')
      return
    }
    try {
      await api.post('/games', data)
      toast.success('Game created successfully!')
      navigate('/games')
    } catch { toast.error('Failed to create game') }
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-surface flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="section-heading">Post a Game</h1>
          <p className="text-textSecondary mt-2">Fill in the details and start gathering players</p>
        </div>

        {showMap && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-xl w-full relative">
              <button className="absolute top-2 right-2 text-lg" onClick={() => setShowMap(false)}>&times;</button>
              <h2 className="text-lg font-semibold mb-2">Pick Location</h2>
              <InlineLocationPicker value={coords || undefined} onChange={handleMapSelect} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="glass-card-solid p-8 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Title</label>
            <input {...register('title')} type="text" className="input-field" placeholder="Game Title" />
            {errors.title && <p className="text-danger text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Description <span className="text-xs text-textSecondary font-normal">(optional)</span></label>
            <textarea {...register('description')} className="input-field min-h-[80px] resize-y" placeholder="Describe your game" />
            {errors.description && <p className="text-danger text-xs mt-1">{errors.description.message}</p>}
          </div>

          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Sport</label>
            <select {...register('sport')} className="select-field">
              <option value="">Choose a sport</option>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.sport && <p className="text-danger text-xs mt-1">{errors.sport.message}</p>}
          </div>

          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Skill Level</label>
            <select {...register('skillLevel')} className="select-field">
              <option value="">Select level</option>
              {['Beginner', 'Intermediate', 'Advanced', 'Mixed'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {errors.skillLevel && <p className="text-danger text-xs mt-1">{errors.skillLevel.message}</p>}
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5 flex items-center gap-1.5"><FiCalendar className="w-4 h-4" /> Date & Time</label>
            <input {...register('startTime')} type="datetime-local" className="input-field" />
            {errors.startTime && <p className="text-danger text-xs mt-1">{errors.startTime.message}</p>}
          </div>

          {/* Duration & Players row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5 flex items-center gap-1.5"><FiClock className="w-4 h-4" /> Duration (min)</label>
              <input {...register('durationMinutes', { valueAsNumber: true })} type="number" className="input-field" placeholder="60" />
              {errors.durationMinutes && <p className="text-danger text-xs mt-1">{errors.durationMinutes.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5 flex items-center gap-1.5"><FiUsers className="w-4 h-4" /> Max Players</label>
              <input {...register('totalSlots', { valueAsNumber: true })} type="number" className="input-field" placeholder="10" />
              <p className="text-[10px] text-textSecondary mt-0.5">Total players needed for this game</p>
              {errors.totalSlots && <p className="text-danger text-xs mt-1">{errors.totalSlots.message}</p>}
            </div>
          </div>

          {/* Already Confirmed & Open Spots */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Players Already Confirmed</label>
              <input {...register('alreadyConfirmed', { valueAsNumber: true })} type="number" min={1} className="input-field" placeholder="1" />
              <p className="text-[10px] text-textSecondary mt-0.5">Including you — e.g., you + 3 friends = 4</p>
              {errors.alreadyConfirmed && <p className="text-danger text-xs mt-1">{errors.alreadyConfirmed.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1.5">Open Spots</label>
              <div className="input-field bg-gray-50 flex items-center text-accent font-semibold">
                {openSpots !== null ? openSpots : '—'}
              </div>
              <p className="text-[10px] text-textSecondary mt-0.5">Auto-calculated: Max Players − Already Confirmed</p>
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5 flex items-center gap-1.5"><FiDollarSign className="w-4 h-4" /> Cost per Person (₹)</label>
            <input {...register('costPerPerson', { valueAsNumber: true })} type="number" className="input-field" placeholder="0 (free)" />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5 flex items-center gap-1.5"><FiMapPin className="w-4 h-4" /> City</label>
            <input {...register('locationCity')} type="text" className="input-field" placeholder="e.g., Bangalore" />
            {errors.locationCity && <p className="text-danger text-xs mt-1">{errors.locationCity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Venue / Address</label>
            <div className="flex gap-2">
              <input {...register('locationAddress')} type="text" className="input-field flex-1" placeholder="e.g., Koramangala Indoor Stadium" />
              <button type="button" className="btn-secondary flex items-center gap-1" onClick={() => setShowMap(true)}><FiMap />Pick</button>
              <button type="button" className="btn-secondary flex items-center gap-1" onClick={handleUseGPS}>GPS</button>
            </div>
            <input type="hidden" {...register('locationLat')} />
            <input type="hidden" {...register('locationLng')} />
          </div>

          {/* Equipment Provided */}
          <div className="flex items-center gap-3">
            <input {...register('equipmentProvided')} type="checkbox" id="equipmentProvided" className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30" />
            <label htmlFor="equipmentProvided" className="text-sm font-medium text-textPrimary">Equipment Provided</label>
          </div>

          {/* Equipment Details */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Equipment Details</label>
            <input {...register('equipmentDetails')} type="text" className="input-field" placeholder="e.g., Balls, rackets, etc." />
          </div>

          {/* Game Visibility */}
          <div className="flex items-center gap-3">
            <input {...register('isPublic')} type="checkbox" id="isPublic" defaultChecked={true} className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30" />
            <label htmlFor="isPublic" className="text-sm font-medium text-textPrimary">Public Game</label>
            <span className="text-xs text-textSecondary">(visible to all players)</span>
          </div>

          {/* Minimum Rating — Optional */}
          <div className="glass-card-solid p-4 space-y-3 border border-border/50 rounded-xl">
            <div className="flex items-center gap-3">
              <input {...register('ratingRequired')} type="checkbox" id="ratingRequired" className="w-4 h-4 rounded border-border text-accent focus:ring-accent/30" />
              <label htmlFor="ratingRequired" className="text-sm font-medium text-textPrimary">Require Minimum Rating</label>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Optional</span>
            </div>
            <p className="text-xs text-textSecondary leading-relaxed pl-7">
              Only allow players with a minimum average rating to request joining. Useful for experienced hosts who want to play with reliable, punctual players. <strong>New players start with no rating</strong>, so setting this too high may limit who can join.
            </p>
            <div className="pl-7">
              <label className="block text-xs text-textSecondary mb-1">Minimum Rating (0 – 5)</label>
              <input
                {...register('minRating', { valueAsNumber: true })}
                type="number"
                step="0.5"
                min={0}
                max={5}
                defaultValue={0}
                placeholder="0"
                className="input-field w-32 text-sm"
              />
              {errors.minRating && <p className="text-danger text-xs mt-1">{errors.minRating.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-textPrimary mb-1.5">Additional Notes</label>
            <textarea {...register('notes')} className="input-field min-h-[80px] resize-y" placeholder="Bring your own gear, water available, etc." />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full !py-3.5 text-base mt-2">
            {isSubmitting ? 'Posting...' : 'Post Game'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
