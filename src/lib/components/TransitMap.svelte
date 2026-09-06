<script lang="ts">
  import { untrack } from 'svelte';
  import maplibregl, { Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
  import { Protocol } from 'pmtiles';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { buildStyle } from '../map/style';
  import { registerGlyphProtocol } from '../map/glyphs';
  import { stopsToGeoJson } from '../map/stops-geojson';
  import { theme } from '../theme.svelte';
  import type { Mode, Stop } from '../gtfs/types';

  let {
    stops,
    modes,
    activeRouteIds = null,
    selectedId = null,
    isochrone = null,
    view,
    onselect,
    onviewchange,
    onready,
  }: {
    stops: Stop[];
    modes: Mode[];
    activeRouteIds?: string[] | null;
    selectedId?: string | null;
    isochrone?: GeoJSON.FeatureCollection | null;
    view: { lon: number; lat: number; zoom: number };
    onselect: (stopId: string | null) => void;
    onviewchange: (view: { lon: number; lat: number; zoom: number }) => void;
    onready?: () => void;
  } = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let styleReady = $state(false);

  const pmtilesUrl = `${window.location.origin}${import.meta.env.BASE_URL}data/ostgrad.pmtiles`;

  /** Everything that has to be re-applied after a style swap lives here. */
  function applyData() {
    if (!map) return;
    const source = map.getSource('stops');
    if (source && 'setData' in source) {
      (source as maplibregl.GeoJSONSource).setData(stopsToGeoJson(stops));
    }
    const iso = map.getSource('isochrone');
    if (iso && 'setData' in iso) {
      (iso as maplibregl.GeoJSONSource).setData(
        isochrone ?? { type: 'FeatureCollection', features: [] },
      );
    }
    map.setFilter('stop-selected', ['==', ['get', 'id'], selectedId ?? '']);
  }

  async function onClusterClick(event: MapMouseEvent) {
    if (!map) return;
    const features = map.queryRenderedFeatures(event.point, { layers: ['cluster'] });
    const cluster = features[0];
    if (!cluster) return;
    const source = map.getSource('stops') as maplibregl.GeoJSONSource;
    const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id as number);
    map.easeTo({
      center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number],
      zoom: Math.min(zoom + 0.35, 17),
      duration: 420,
    });
  }

  let styleKey = '';

  function currentStyle() {
    return buildStyle({ theme: theme.value, pmtilesUrl, modes, activeRouteIds });
  }

  function currentStyleKey() {
    return JSON.stringify([theme.value, modes, activeRouteIds]);
  }

  /**
   * Creating the map is a one-off: everything reactive is read through
   * `untrack`, or a new camera position would tear the map down and build it
   * again on every pan.
   */
  $effect(() => {
    registerGlyphProtocol();
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const start = untrack(() => ({ ...view }));
    styleKey = untrack(currentStyleKey);

    const instance = new MapLibreMap({
      container,
      style: untrack(currentStyle),
      center: [start.lon, start.lat],
      zoom: start.zoom,
      minZoom: 9,
      maxZoom: 17,
      attributionControl: { compact: true },
      // The generated basemap has no imagery worth tilting towards.
      pitchWithRotate: false,
      dragRotate: false,
    });
    map = instance;
    if (import.meta.env.DEV) {
      // A handle for poking at the map from the console while developing.
      (globalThis as unknown as { __map?: MapLibreMap }).__map = instance;
    }

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(
      new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }),
      'bottom-left',
    );
    instance.keyboard.enable();

    instance.on('load', () => {
      instance.resize();
      applyData();
      styleReady = true;
      onready?.();
    });

    instance.on('click', 'cluster', onClusterClick);
    instance.on('click', 'stop-point', (event) => {
      const feature = event.features?.[0];
      if (feature) onselect(feature.properties.id as string);
    });
    instance.on('click', (event) => {
      const hits = instance.queryRenderedFeatures(event.point, {
        layers: ['stop-point', 'cluster'],
      });
      if (!hits.length) onselect(null);
    });

    for (const layer of ['stop-point', 'cluster']) {
      instance.on('mouseenter', layer, () => {
        instance.getCanvas().style.cursor = 'pointer';
      });
      instance.on('mouseleave', layer, () => {
        instance.getCanvas().style.cursor = '';
      });
    }

    /**
     * The map is built inside a grid cell whose width is not final on the frame
     * the component mounts, and MapLibre sizes its canvas once at construction.
     * Watching the container keeps the two in step.
     */
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    instance.on('moveend', () => {
      const centre = instance.getCenter();
      onviewchange({
        lon: Number(centre.lng.toFixed(5)),
        lat: Number(centre.lat.toFixed(5)),
        zoom: Number(instance.getZoom().toFixed(2)),
      });
    });

    return () => {
      observer.disconnect();
      instance.remove();
      map = undefined;
      styleReady = false;
      maplibregl.removeProtocol('pmtiles');
    };
  });

  // Theme, mode filters and route visibility all live in the style, so they are
  // applied by diffing a freshly built one — MapLibre keeps the camera.
  $effect(() => {
    const key = currentStyleKey();
    if (!map || !styleReady || key === styleKey) return;
    styleKey = key;
    map.setStyle(currentStyle());
    map.once('styledata', applyData);
  });

  $effect(() => {
    if (!map || !styleReady) return;
    const source = map.getSource('stops') as maplibregl.GeoJSONSource | undefined;
    source?.setData(stopsToGeoJson(stops));
  });

  $effect(() => {
    if (!map || !styleReady) return;
    map.setFilter('stop-selected', ['==', ['get', 'id'], selectedId ?? '']);
  });

  $effect(() => {
    if (!map || !styleReady) return;
    const source = map.getSource('isochrone') as maplibregl.GeoJSONSource | undefined;
    source?.setData(isochrone ?? { type: 'FeatureCollection', features: [] });
  });

  export function flyToStop(stop: Stop) {
    map?.easeTo({ center: [stop.lon, stop.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  }
</script>

<div class="map" bind:this={container} role="application" aria-label="Map of the Ostgrad transit network"></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }

  .map :global(.maplibregl-ctrl-attrib) {
    font-size: 10px;
  }
</style>
