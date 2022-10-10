import { gql } from '@apollo/client';

export const commentFieldsFragment = gql`
  fragment CommentFields on Comment {
    id
    createdAt
    html
    reactions
    userReactions
    fromCollective {
      id
      type
      name
      slug
      imageUrl
    }
  }
`;

export const conversationListFragment = gql`
  fragment ConversationListFragment on ConversationCollection {
    totalCount
    offset
    limit
    nodes {
      id
      title
      summary
      slug
      createdAt
      tags
      fromCollective {
        id
        name
        type
        slug
        imageUrl
      }
      followers(limit: 5) {
        totalCount
        nodes {
          id
          slug
          type
          name
          imageUrl(height: 64)
        }
      }
      stats {
        id
        commentsCount
      }
    }
  }
`;

export const isUserFollowingConversationQuery = gql`
  query IsUserFollowingConversation($id: String!) {
    loggedInAccount {
      id
      slug
      imageUrl
      type
      name
      ... on Individual {
        isFollowingConversation(id: $id)
      }
    }
  }
`;

export const updateListFragment = gql`
  fragment UpdateListFragment on UpdateCollection {
    totalCount
    offset
    limit
    nodes {
      id
      slug
      title
      summary
      createdAt
      publishedAt
      isPrivate
      userCanSeeUpdate
      fromAccount {
        id
        type
        name
        slug
        imageUrl
      }
    }
  }
`;
