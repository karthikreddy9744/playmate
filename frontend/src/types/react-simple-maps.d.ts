declare module 'react-simple-maps' {
  import React from 'react'

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, any>
    style?: React.CSSProperties
    width?: number
    height?: number
    children?: React.ReactNode
  }

  export interface ZoomableGroupProps {
    zoom?: number
    minZoom?: number
    maxZoom?: number
    center?: [number, number]
    translateExtent?: [[number, number], [number, number]]
    children?: React.ReactNode
    onMoveEnd?: (args: any) => void
  }

  export interface GeographiesProps {
    geography: string | Record<string, any>
    children: (args: { geographies: any[] }) => React.ReactNode
  }

  export interface GeographyProps {
    geography: any
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseMove?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    onClick?: (e: React.MouseEvent) => void
  }

  export const ComposableMap: React.FC<ComposableMapProps>
  export const ZoomableGroup: React.FC<ZoomableGroupProps>
  export const Geographies: React.FC<GeographiesProps>
  export const Geography: React.FC<GeographyProps>
  export const Marker: React.FC<any>
  export const Line: React.FC<any>
  export const Annotation: React.FC<any>
  export const Sphere: React.FC<any>
  export const Graticule: React.FC<any>
}
