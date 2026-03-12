import React, { useState } from 'react'
import { AdvancedImage } from '@cloudinary/react'
import { CloudinaryImage } from '@cloudinary/url-gen'
import { fill } from '@cloudinary/url-gen/actions/resize'
import { toast } from 'react-toastify'
import cloudinary from '../lib/cloudinary' // Import the initialized Cloudinary instance

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void
  initialImageUrl?: string
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUploadSuccess, initialImageUrl }) => {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setImageFile(file)
      setImageUrl(URL.createObjectURL(file)) // For local preview
    }
  }

  const handleUpload = async () => {
    if (!imageFile) {
      toast.error('Please select an image to upload.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET) // Your Cloudinary upload preset

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error('Image upload failed.')
      }

      const data = await response.json()
      const uploadedUrl = data.secure_url
      setImageUrl(uploadedUrl)
      onUploadSuccess(uploadedUrl)
      toast.success('Image uploaded successfully!')
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image.')
    } finally {
      setLoading(false)
    }
  }

  const cldImage = imageUrl
    ? new CloudinaryImage(imageUrl.split('/').pop()?.split('.')[0] || '', { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME }).resize(fill().width(250).height(250))
    : undefined

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-card-solid">
      {imageUrl && (
        <div className="mb-4">
          {cldImage ? (
            <AdvancedImage cldImg={cldImage} className="w-48 h-48 object-cover rounded-lg" />
          ) : (
            <img src={imageUrl} alt="Preview" className="w-48 h-48 object-cover rounded-lg" />
          )}
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-sm text-textPrimary bg-surface rounded-xl border border-border
                   file:mr-4 file:py-2 file:px-4
                   file:rounded-full file:border-0
                   file:text-sm file:font-semibold
                   file:bg-accent file:text-white
                   hover:file:bg-accent/80 mb-4 focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <button
        onClick={handleUpload}
        disabled={!imageFile || loading}
        className="btn-primary py-2 px-4 text-sm"
      >
        {loading ? 'Uploading...' : 'Upload Image'}
      </button>
    </div>
  )
}

export default ImageUpload
