import { useCallback, useEffect, useState } from 'react'
import { errMsg } from '../services/api'

/** Data-loading helper: { data, loading, error, reload (silent), refresh } */
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try { setState({ data: await fn(), loading: false, error: null }) }
    catch (e) { setState((s) => ({ data: silent ? s.data : null, loading: false, error: errMsg(e) })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { load() }, [load])
  return { ...state, reload: () => load(true), refresh: load }
}
