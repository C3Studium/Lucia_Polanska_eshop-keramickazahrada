"use client"

import { 
  createContext, 
  useContext, 
  useEffect, 
  useState,
} from "react"
import { HttpTypes } from "@medusajs/types"
import { sdk } from "../config"

type RegionContextType = {
  region?: HttpTypes.StoreRegion
  regions: HttpTypes.StoreRegion[]
  setRegion: React.Dispatch<
    React.SetStateAction<HttpTypes.StoreRegion | undefined>
  >
}

const RegionContext = createContext<RegionContextType | null>(null)

type RegionProviderProps = {
  children: React.ReactNode
  initialCountryCode?: string
}

export const RegionProvider = (
  { children, initialCountryCode }: RegionProviderProps
) => {
  const [regions, setRegions] = useState<
    HttpTypes.StoreRegion[]
  >([])
  const [region, setRegion] = useState<
    HttpTypes.StoreRegion
  >()

  useEffect(() => {
    if (regions.length) {
      return
    }

    sdk.store.region.list()
      .then(({ regions }) => {
        setRegions(regions)
      })
  }, [])

  useEffect(() => {
    if (!regions.length || !initialCountryCode) {
      return
    }

    const routeRegion = regions.find((candidate) =>
      candidate.countries?.some(
        (country) => country.iso_2 === initialCountryCode.toLowerCase()
      )
    )

    if (routeRegion && routeRegion.id !== region?.id) {
      setRegion(routeRegion)
    }
  }, [regions, initialCountryCode, region?.id])

  useEffect(() => {
    if (region) {
      // set its ID in the local storage in
      // case it changed
      localStorage.setItem("region_id", region.id)
      return
    }

    const routeRegion = initialCountryCode
      ? regions.find((candidate) =>
          candidate.countries?.some(
            (country) => country.iso_2 === initialCountryCode.toLowerCase()
          )
        )
      : undefined
    if (routeRegion) {
      setRegion(routeRegion)
      return
    }

    const regionId = localStorage.getItem("region_id")
    if (!regionId) {
      if (regions.length) {
        setRegion(regions[0])
      }
    } else {
      // retrieve selected region
      sdk.store.region.retrieve(regionId)
      .then(({ region: dataRegion }) => {
        setRegion(dataRegion)
      })
    }
  }, [region, regions, initialCountryCode])

  return (
    <RegionContext.Provider value={{
      region,
      regions,
      setRegion,
    }}>
      {children}
    </RegionContext.Provider>
  )
}

export const useRegion = () => {
  const context = useContext(RegionContext)

  if (!context) {
    throw new Error("useRegion must be used within a RegionProvider")
  }

  return context
}
