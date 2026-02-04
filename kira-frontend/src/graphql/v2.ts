export const LISTING_QUERY = gql`
  query Listing($listingId: ID!) {
    listing(listingId: $listingId) {
      id
      title
      slug
      description
      price
      currency
      city
      region
      country
      status
      isFeatured
      createdAt

      category {
        id
        name
        slug
      }

      dealer {
        dealershipName
        phone
        whatsapp
        city
        region
        country
      }

      images {
        id
        isCover
        sortOrder
        imageUrl
        thumbnailUrl
      }

      attributeValues {
        id
        value
        attribute {
          id
          key
          label
          dataType
          choices
          sortOrder
        }
      }

      isFavorited
    }
  }
`;
