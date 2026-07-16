export interface BrandingMap {
  latitude: number
  longitude: number
}

export interface BrandingContact {
  name: string
  email: string
  phone: string
}

export interface BrandingAddress {
  line1: string
  line2: string
  postTown: string
  county: string
  postCode: string
}

export interface Branding {
  name: string
  description: string
  directions: string
  logoUrl: string
  map: BrandingMap
  contact: BrandingContact
  address: BrandingAddress
}
