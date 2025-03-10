import React from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { truncate, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';
import styled, { css } from 'styled-components';

import { i18nGraphqlException } from '../../lib/errors';
import { API_V2_CONTEXT } from '../../lib/graphql/helpers';

import ConfirmationModal from '../ConfirmationModal';
import { Box, Flex } from '../Grid';
import LoadingPlaceholder from '../LoadingPlaceholder';
import MessageBoxGraphqlError from '../MessageBoxGraphqlError';
import StyledCollectiveCard from '../search-page/StyledCollectiveCard';
import SearchBar from '../SearchBar';
import StyledButton from '../StyledButton';
import StyledCheckbox from '../StyledCheckbox';
import StyledLink from '../StyledLink';
import { P } from '../Text';
import { TOAST_TYPE, useToasts } from '../ToastProvider';

import { banAccountsMutation } from './BanAccounts';
import BanAccountsSummary from './BanAccountsSummary';

export const searchQuery = gql`
  query SearchPage($term: String!, $offset: Int) {
    accounts(
      searchTerm: $term
      limit: 12
      offset: $offset
      skipRecentAccounts: false
      orderBy: { field: CREATED_AT, direction: DESC }
      type: [COLLECTIVE, EVENT, FUND, INDIVIDUAL, ORGANIZATION, PROJECT]
    ) {
      nodes {
        id
        isActive
        type
        slug
        name
        tags
        isHost
        imageUrl
        backgroundImageUrl
        description
        longDescription
        website
        currency
        location {
          id
          country
        }
        stats {
          id
          totalAmountReceived(useCache: true) {
            currency
            valueInCents
          }
        }
        ... on Organization {
          host {
            id
            hostFeePercent
            totalHostedCollectives
          }
        }
        ... on AccountWithParent {
          parent {
            id
            slug
            backgroundImageUrl
          }
        }
        backers: members(role: BACKER) {
          totalCount
        }
        memberOf(role: BACKER) {
          totalCount
        }
      }
      limit
      offset
      totalCount
    }
  }
`;

const CardContainer = styled.div`
  border-radius: 16px;
  cursor: crosshair;
  transition: box-shadow 0.3s;
  &:hover {
    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
  }
  ${props =>
    props.$isSelected &&
    css`
      box-shadow: 0px 0px 10px red;
      &:hover {
        box-shadow: 0px 0px 5px red;
      }
    `}
`;

const AccountsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-gap: 20px;
  margin-top: 20px;
`;

const BanAccountsWithSearch = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const { data, loading, error, refetch } = useQuery(searchQuery, {
    variables: { term: searchTerm },
    context: API_V2_CONTEXT,
    skip: !searchTerm,
  });
  const [selectedAccounts, setSelectedAccounts] = React.useState([]);
  const [includeAssociatedAccounts, setIncludeAssociatedAccounts] = React.useState(true);
  const [dryRunData, setDryRunData] = React.useState(null);
  const [_banAccounts, { loading: submitting }] = useMutation(banAccountsMutation, { context: API_V2_CONTEXT });
  const { addToast } = useToasts();
  const intl = useIntl();
  const isValid = Boolean(selectedAccounts?.length);
  const toggleAccountSelection = account => {
    return !selectedAccounts.some(selectedAccount => selectedAccount.id === account.id)
      ? setSelectedAccounts(uniqBy([...selectedAccounts, account], 'id'))
      : setSelectedAccounts(selectedAccounts.filter(a => a.id !== account.id));
  };

  const banAccounts = (dryRun = true) =>
    _banAccounts({
      variables: {
        account: selectedAccounts.map(a => ({ id: a.id })),
        includeAssociatedAccounts,
        dryRun,
      },
    });

  return (
    <div>
      <SearchBar placeholder="Search accounts" onSubmit={setSearchTerm} disabled={loading || submitting} />

      {error ? (
        <MessageBoxGraphqlError error={error} />
      ) : loading ? (
        <LoadingPlaceholder height={300} width="100%" mt="20px" />
      ) : data?.accounts?.nodes?.length ? (
        <AccountsContainer>
          {data.accounts.nodes.map(account => (
            <CardContainer
              key={account.id}
              $isSelected={selectedAccounts.some(a => a.id === account.id)}
              onClick={() => toggleAccountSelection(account)}
              role="button"
              tabIndex={0}
              onKeyPress={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleAccountSelection(account);
                }
              }}
            >
              <StyledCollectiveCard collective={account} bodyHeight={200} pb={3} px={3} fontSize="11px">
                <div>
                  {account.website && (
                    <Box mb={2}>
                      <StyledLink openInNewTabNoFollow href={account.website}>
                        {truncate(account.website, { length: 128 })}
                      </StyledLink>
                    </Box>
                  )}
                  {account.description && <P fontSize="11px">{truncate(account.description, { length: 120 })}</P>}
                </div>
              </StyledCollectiveCard>
            </CardContainer>
          ))}
        </AccountsContainer>
      ) : searchTerm ? (
        <P my={4} textAlign="center" fontSize="25px">
          No results for {searchTerm}
        </P>
      ) : null}

      <Flex flexWrap="wrap" px={1} mt={4} justifyContent="center">
        <StyledCheckbox
          label="Include all associated accounts"
          checked={includeAssociatedAccounts}
          onChange={({ checked }) => {
            setIncludeAssociatedAccounts(checked);
          }}
        />
      </Flex>

      <StyledButton
        mt={3}
        width="100%"
        buttonStyle="primary"
        disabled={!isValid}
        loading={submitting}
        onClick={async () => {
          try {
            const result = await banAccounts(true);
            setDryRunData(result.data.banAccount);
          } catch (e) {
            addToast({
              type: TOAST_TYPE.ERROR,
              message: i18nGraphqlException(intl, e),
            });
          }
        }}
      >
        Analyze
      </StyledButton>
      {dryRunData && (
        <ConfirmationModal
          isDanger
          continueLabel="Ban accounts"
          header="Ban accounts"
          cancelHandler={() => setDryRunData(null)}
          disableSubmit={!dryRunData.isAllowed}
          continueHandler={async () => {
            try {
              const result = await banAccounts(false);
              setDryRunData(null);
              setSelectedAccounts([]);
              refetch(); // Refresh the search results, no need to wait for it
              addToast({
                type: TOAST_TYPE.SUCCESS,
                title: `Successfully banned ${result.data.banAccount.accounts.length} accounts`,
                message: <P whiteSpace="pre-wrap">{result.data.banAccount.message}</P>,
              });
            } catch (e) {
              addToast({
                type: TOAST_TYPE.ERROR,
                message: i18nGraphqlException(intl, e),
              });
            }
          }}
        >
          <BanAccountsSummary dryRunData={dryRunData} />
        </ConfirmationModal>
      )}
    </div>
  );
};

BanAccountsWithSearch.propTypes = {};

export default BanAccountsWithSearch;
