'use dom';

import { ReaderAssetSpike } from '../../../src/reader-core/ReaderAssetSpike';
import '../../../src/reader-core/reader.css';

export default function ReaderAssetSpikeDOM({ title, content }: {
  title: string;
  content: string;
  dom?: import('expo/dom').DOMProps;
}) {
  return <ReaderAssetSpike title={title} content={content} development={process.env.NODE_ENV !== 'production'} />;
}
