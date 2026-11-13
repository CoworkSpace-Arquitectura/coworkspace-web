import { FloorPlanArt } from './FloorPlanArt';

/** Foto de la sede o, si no tiene, su plano ilustrado. */
export function SpacePicture({ src, seed, alt }: { src: string | null; seed: string; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="picture" loading="lazy" />;
  }
  return <FloorPlanArt seed={seed} label={`${alt} (ilustración, aún sin fotos)`} />;
}
