'use client';

import { Component, type ReactNode } from 'react';
import MapErrorFallback from '@/components/map/MapErrorFallback';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Catch Leaflet mount errors so lists and forms stay usable. */
export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <MapErrorFallback />;
    return this.props.children;
  }
}
