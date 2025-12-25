import { useNavigate } from "react-router-dom";
import { useQuery } from "urql";

import Grid from "@mui/material/Grid";
import {
  Box,
  Container,
  Typography,
  Stack,
  Card,
  CardContent,
  Skeleton,
} from "@mui/material";

const QUERY = `
query ExploreFeatured {
  featured: listingsFeatured {
    id
    title
    slug
    price
    currency
    city
    region
    country
    images {
      imageUrl
      thumbnailUrl
      isCover
    }
  }
}
`;

type Image = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  isCover?: boolean;
};

type Listing = {
  id: string;
  title: string;
  slug: string;
  price?: number | null;
  currency?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  images?: Image[];
};

function money(value: number | null | undefined, currency = "USD"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function pickCover(images?: Image[]): string {
  const img =
    images?.find((i) => i.isCover)?.thumbnailUrl ||
    images?.[0]?.thumbnailUrl ||
    images?.[0]?.imageUrl ||
    "";
  return img;
}

export default function ExplorePage() {
  const navigate = useNavigate();

  const [{ data, fetching }] = useQuery<{ featured: Listing[] }>({
    query: QUERY,
    requestPolicy: "network-only",
  });

  const items = data?.featured ?? [];

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={900}>
          Explore Listings
        </Typography>
        <Typography color="text.secondary">
          Discover featured listings across all categories
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {(fetching ? Array.from({ length: 6 }) : items).map(
          (item, idx: number) => (
            <Grid
              item
              key={fetching ? idx : (item as Listing).id}
              xs={12}
              sm={6}
              md={4}
            >
              <Card
                onClick={() =>
                  !fetching &&
                  navigate(`/listing/${(item as Listing).slug}`)
                }
                sx={{
                  height: "100%",
                  cursor: fetching ? "default" : "pointer",
                  transition: "transform .15s ease",
                  "&:hover": { transform: fetching ? "none" : "translateY(-2px)" },
                }}
              >
                {fetching ? (
                  <Skeleton variant="rectangular" height={180} />
                ) : (
                  <Box
                    sx={{
                      height: 180,
                      backgroundImage: `url(${pickCover(
                        (item as Listing).images
                      )})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}

                <CardContent>
                  {fetching ? (
                    <>
                      <Skeleton width="70%" />
                      <Skeleton width="40%" />
                    </>
                  ) : (
                    <>
                      <Typography fontWeight={800}>
                        {(item as Listing).title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {money(
                          (item as Listing).price,
                          (item as Listing).currency || "USD"
                        )}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        )}
      </Grid>
    </Container>
  );
}
