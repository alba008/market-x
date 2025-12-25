// src/pages/ExplorePage.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "urql";

import Grid from "@mui/material/Grid";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";

type ListingImage = {
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  isCover?: boolean | null;
};

type Listing = {
  id: string;
  title?: string | null;
  price?: number | string | null;
  currency?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  city?: string | null;
  region?: string | null;
  images?: ListingImage[] | null;
};

const FEATURED_QUERY = `
  query ExploreFeatured {
    featured {
      id
      title
      price
      currency
      year
      make
      model
      city
      region
      images {
        thumbnailUrl
        imageUrl
        isCover
      }
    }
  }
`;

function resolveMediaUrl(raw?: string | null) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const base =
    (import.meta.env.VITE_MEDIA_BASE_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      "").trim();

  if (base) return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
  return url;
}

function pickCover(images?: ListingImage[] | null) {
  const imgs = images || [];
  const cover = imgs.find((i) => i?.isCover && (i.thumbnailUrl || i.imageUrl)) || imgs[0];
  return resolveMediaUrl(cover?.thumbnailUrl || cover?.imageUrl || "");
}

function money(n: unknown, currency = "USD") {
  const val = Number(n);
  if (!Number.isFinite(val)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(val);
  } catch {
    return `${val}`;
  }
}

export default function ExplorePage() {
  const nav = useNavigate();
  const [{ data, fetching, error }] = useQuery({ query: FEATURED_QUERY, requestPolicy: "cache-and-network" });

  const items: Listing[] = useMemo(() => {
    return (data as any)?.featured ?? [];
  }, [data]);

  return (
    <Box sx={{ px: { xs: 1.25, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 1000, fontSize: { xs: 20, md: 24 } }}>Explore</Typography>
        <Typography color="text.secondary">Featured listings across all categories.</Typography>
      </Stack>

      {error ? (
        <Typography color="error">{error.message}</Typography>
      ) : null}

      <Grid container spacing={2}>
        {(fetching ? Array.from({ length: 6 }) : items).map((item: any, idx: number) => {
          const listing: Listing | null = fetching ? null : (item as Listing);
          const cover = listing ? pickCover(listing.images) : "";
          const title =
            listing?.title ||
            `${listing?.year ?? ""} ${listing?.make ?? ""} ${listing?.model ?? ""}`.trim() ||
            "Listing";

          return (
            <Grid key={listing?.id ?? idx} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "1px solid rgba(244,246,248,0.10)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                  cursor: listing ? "pointer" : "default",
                }}
                onClick={() => {
                  if (!listing) return;
                  nav(`/listing/${listing.id}`);
                }}
              >
                {listing ? (
                  <Box
                    sx={{
                      height: 180,
                      bgcolor: "rgba(0,0,0,0.25)",
                      backgroundImage: cover ? `url("${cover}")` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <Skeleton variant="rectangular" height={180} />
                )}

                <CardContent>
                  {listing ? (
                    <Stack spacing={0.5}>
                      <Typography sx={{ fontWeight: 1000 }}>{title}</Typography>
                      <Typography sx={{ fontWeight: 900, color: "rgba(201,162,77,0.95)" }}>
                        {money(listing.price, listing.currency || "USD")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {listing.city || listing.region ? `${listing.city ? listing.city + ", " : ""}${listing.region || ""}` : "—"}
                      </Typography>
                    </Stack>
                  ) : (
                    <>
                      <Skeleton width="70%" />
                      <Skeleton width="45%" />
                      <Skeleton width="55%" />
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
