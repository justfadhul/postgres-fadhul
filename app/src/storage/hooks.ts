import { useEffect, useState } from 'react'
import { all, get, subscribe, type StoreName } from './store'

/** Every record in a store, kept fresh after writes. Undefined until first read. */
export function useStore<T>(store: StoreName): Record<string, T> | undefined {
  const [data, setData] = useState<Record<string, T>>()
  useEffect(() => {
    let live = true
    const load = () => all<T>(store).then((d) => live && setData(d), () => live && setData({}))
    void load()
    const off = subscribe((s) => s === store && void load())
    return () => {
      live = false
      off()
    }
  }, [store])
  return data
}

/** One record, kept fresh after writes. */
export function useRecord<T>(store: StoreName, key: string): T | undefined {
  const [data, setData] = useState<T>()
  useEffect(() => {
    let live = true
    const load = () => get<T>(store, key).then((d) => live && setData(d), () => undefined)
    void load()
    const off = subscribe((s) => s === store && void load())
    return () => {
      live = false
      off()
    }
  }, [store, key])
  return data
}
