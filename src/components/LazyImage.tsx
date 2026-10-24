import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react';

/**
 * 遅延読み込み付き画像（MVP-043）。
 *
 * - 既定でブラウザ標準の `loading="lazy" decoding="async"` を付ける。
 *   `IntersectionObserver` は使わない（標準の lazy で十分で、依存も実装も増やさない）。
 * - `width` / `height` を必須にし、読み込み前からレイアウト領域を確保する
 *   （低速回線でも画像待ちでボタン位置がずれない＝初回操作を阻害しない）。
 * - `priority` を付けると `loading="eager" fetchpriority="high"` に切り替わる。
 *   ファーストビューに本当に必要な 1 枚だけに使う。
 * - 読み込み失敗時は `<img>` を外し、同じ大きさの背景色（`--color-surface-aged`）の
 *   プレースホルダーを置く。`uiIllustration('empty')` 等の画像には差し替えない
 *   （失敗した状況でさらに画像を要求しないため）。
 *
 * 組み込み方（既存コンポーネントの置き換えは MVP-022/023/026/027/035 の完了後に行う）:
 *   <LazyImage src={documentThumbnail(caseId, id)} alt="" width={440} height={580} />
 *   <LazyImage src={assetUrl('characters/shinobu/poses/point.png')} alt="..." width={1086} height={1448} priority />
 * CSS 側で `width` / `height` を上書きしている場合（`.doc-tile img` など）は
 * 属性値は「比率」の指定として働くので、実寸ではなく元画像の画素数を渡せばよい。
 */
export interface LazyImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'loading' | 'decoding' | 'width' | 'height'
> {
  src: string;
  /** 代替テキスト。装飾画像は空文字 */
  alt: string;
  /** レイアウト確保のため必須（元画像の画素数、または表示サイズ） */
  width: number;
  height: number;
  /** ファーストビューに必要な画像だけ true（eager + fetchpriority=high） */
  priority?: boolean;
}

/** `fetchpriority` は React 18 の型定義に無いため小文字属性として渡す */
type FetchPriorityAttr = { fetchpriority?: 'high' | 'low' | 'auto' };

export function LazyImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  style,
  onError,
  ...rest
}: LazyImageProps) {
  // 失敗した src を覚える。src が差し替わればその時点で自動的に再試行になる（effect 不要）
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (failed) {
    const placeholderStyle: CSSProperties = {
      display: 'inline-block',
      width,
      height,
      maxWidth: '100%',
      background: 'var(--color-surface-aged)',
      ...style,
    };
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={className ? `${className} lazy-image-fallback` : 'lazy-image-fallback'}
        style={placeholderStyle}
        data-src={src}
        data-testid="lazy-image-fallback"
      />
    );
  }

  const priorityAttrs: FetchPriorityAttr = priority ? { fetchpriority: 'high' } : {};

  return (
    <img
      {...rest}
      {...priorityAttrs}
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        onError?.(e);
        setFailedSrc(src);
      }}
    />
  );
}
