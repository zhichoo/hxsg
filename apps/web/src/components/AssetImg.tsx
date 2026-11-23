import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { getAssetUrlSync, resolveAssetUrl } from '../platform/host';

export function useAssetUrl(path: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    path ? (getAssetUrlSync(path) ?? undefined) : undefined,
  );

  useEffect(() => {
    if (!path) {
      setUrl(undefined);
      return;
    }
    const sync = getAssetUrlSync(path);
    if (sync) {
      setUrl(sync);
      return;
    }
    let cancelled = false;
    resolveAssetUrl(path)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

interface AssetImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  path: string;
}

export function AssetImg({ path, alt = '', ...rest }: AssetImgProps) {
  const src = useAssetUrl(path);
  if (!src) {
    return <span aria-hidden="true" className={rest.className} />;
  }
  return <img src={src} alt={alt} {...rest} />;
}

interface AssetBgProps {
  path: string;
  className?: string;
  children: ReactNode;
}

/**
 * Renders a retro textured background using an underlying <AssetImg> instead of inline
 * CSS backgroundImage url(), ensuring full compatibility with MAPP Blob URL assets & CSP.
 */
export function AssetBg({ path, className = '', children }: AssetBgProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AssetImg
        path={path}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover pixelated"
      />
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
