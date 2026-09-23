import React from 'react';
import { createRoot } from 'react-dom/client';
import fixture from '../../fixtures/mobile/reader-kitchen-sink.json';
import { ReaderAssetSpike } from '../reader-core/ReaderAssetSpike';
import '../reader-core/reader.css';

// Served only by the Vite development middleware, not imported by the web app.
createRoot(document.getElementById('root')!).render(
  <ReaderAssetSpike title={fixture.title} content={fixture.content} development />,
);
