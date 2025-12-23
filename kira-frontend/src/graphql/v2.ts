import { gql } from "urql";

export const CATEGORIES_QUERY = gql`
  query Categories {
    categories {
      id
      name
      slug
    }
  }
`;

export const CATEGORY_ATTRIBUTES_QUERY = gql`
  query CategoryAttributes($categorySlug: String!) {
    categoryAttributes(categorySlug: $categorySlug) {
      id
      key
      label
      dataType
      isFilterable
      isRequired
      choices
      sortOrder
    }
  }
`;

export const LISTINGS_PAGE_V2_QUERY = gql`
  query ListingsPageV2($filters: ListingsV2FilterInput, $pagination: PaginationInput) {
    listingsPageV2(filters: $filters, pagination: $pagination) {
      totalCount
      pageInfo {
        limit
        offset
        hasNext
        hasPrev
      }
      results {
        id
        title
        slug
        price
        currency
        city
        region
        country
        isFeatured
        createdAt

        category { name slug }
        dealer { dealershipName phone whatsapp city region country }

        images { id isCover imageUrl thumbnailUrl }

        attributeValues {
          attribute { key label dataType }
          value
        }

        isFavorited
      }
    }
  }
`;

export const TOGGLE_FAVORITE_V2_MUTATION = gql`
  mutation ToggleFavoriteV2($listingId: ID!) {
    toggleFavoriteV2(listingId: $listingId)
  }
`;
