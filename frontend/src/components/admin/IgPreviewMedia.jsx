import { useState } from "react";

export const IgPreviewMedia = ({ preview }) => {
  const [slide, setSlide] = useState(0);

  if (preview.mime === "video/mp4") {
    return (
      <video
        src={preview.media_b64}
        controls
        autoPlay
        loop
        muted
        playsInline
        data-testid="admin-ig-preview-video"
        className="w-full rounded"
        style={{ aspectRatio: "9/16", maxHeight: "600px" }}
      />
    );
  }

  const slides = preview.slides_b64;
  if (!slides) {
    return (
      <img
        src={preview.media_b64}
        alt="Preview card"
        data-testid="admin-ig-preview-image"
        className="w-full aspect-square object-cover rounded"
      />
    );
  }

  return (
    <div data-testid="admin-ig-preview-carousel">
      <img
        src={slides[slide]}
        alt={`Carousel slide ${slide + 1}`}
        data-testid="admin-ig-preview-carousel-slide"
        className="w-full aspect-square object-cover rounded"
      />
      <div className="mt-3 flex gap-2">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            data-testid={`admin-ig-carousel-thumb-${i}`}
            className={`w-16 h-16 rounded overflow-hidden border-2 transition-opacity ${i === slide ? "border-terracotta" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <img src={s} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};
