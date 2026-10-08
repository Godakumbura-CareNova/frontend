import React, { useEffect, useRef, useState } from 'react';
export default function PharmacyLocation({ information }) {
  const [failed, setFailed] = useState(false);
  const mapRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    const fail = () => setFailed(true);
    map?.addEventListener('error', fail);
    return () => map?.removeEventListener('error', fail);
  }, [information.mapEmbedUrl]);
  const location = information.locationDescription || information.address;
  return <section className="management-card"><h2>Our location</h2>
    <p className="pharmacy-preserve-lines">{location || 'Location details have not been published yet.'}</p>
    {information.mapEmbedUrl && !failed && <iframe ref={mapRef} key={information.mapEmbedUrl} title="Pharmacy location map" src={information.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer" className="pharmacy-map" />}
    {failed && <p role="status">The map is unavailable. Please use the location details below.</p>}
    {location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer">Open location in maps</a>}
    {information.mapEmbedUrl && <p className="empty-state">If the map does not load, use the location details or the map link.</p>}
  </section>;
}
