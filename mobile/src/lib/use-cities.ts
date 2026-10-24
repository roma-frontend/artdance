import { useCallback, useEffect, useState } from 'react';

import { listCities, type CityView } from './cities';

export type CitiesState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; cities: CityView[] };

/** Список городов с возможностью перезагрузки; экраны городов и районов берут данные отсюда. */
export function useCities(): { state: CitiesState; reload: () => void } {
  const [state, setState] = useState<CitiesState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    listCities()
      .then((cities) => {
        if (alive) setState({ status: 'ready', cities });
      })
      .catch(() => {
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }, []);

  return { state, reload };
}
