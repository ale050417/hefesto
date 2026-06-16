import Image from "next/image";

type GalleryImage = { url: string; alt: string };

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const main = images[0];
  return (
    <div>
      <div className="border-surface-2 bg-surface-2 relative aspect-square overflow-hidden rounded-lg border">
        {main ? (
          <Image
            src={main.url}
            alt={main.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="border-surface-2 bg-surface-2 relative aspect-square overflow-hidden rounded-md border"
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
