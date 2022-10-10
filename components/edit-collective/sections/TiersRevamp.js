import React from 'react';
import PropTypes from 'prop-types';
import { gql, useQuery } from '@apollo/client';
import { Mutation } from '@apollo/client/react/components';
import { get } from 'lodash';
import { FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import { API_V2_CONTEXT } from '../../../lib/graphql/helpers';

import AdminContributeCardsContainer from '../../contribute-cards/AdminContributeCardsContainer';
import ContributeCrypto from '../../contribute-cards/ContributeCrypto';
import ContributeCustom from '../../contribute-cards/ContributeCustom';
import ContributeTier from '../../contribute-cards/ContributeTier';
import { Box, Grid } from '../../Grid';
import Image from '../../Image';
import LoadingPlaceholder from '../../LoadingPlaceholder';
import MessageBoxGraphqlError from '../../MessageBoxGraphqlError';
import StyledCheckbox from '../../StyledCheckbox';
import StyledHr from '../../StyledHr';
import StyledLink from '../../StyledLink';
import { P, Span, Strong } from '../../Text';
import { editAccountSettingsMutation } from '../mutations';

import { collectiveSettingsV1Query } from './EditCollectivePage';

// TODO Make this a common function with the contribute section
const getFinancialContributions = (collective, sortedTiers) => {
  const hasCustomContribution = !get(collective, 'settings.disableCustomContributions', false);
  const hasCryptoContribution =
    !get(collective, 'settings.disableCryptoContributions', true) &&
    get(collective, 'host.settings.cryptoEnabled', false);
  const waysToContribute = [];

  sortedTiers.forEach(tier => {
    if (tier === 'custom') {
      if (hasCustomContribution) {
        waysToContribute.push({
          key: 'custom',
          Component: ContributeCustom,
          componentProps: {
            collective,
            hideContributors: true,
            hideCTA: true,
          },
        });
      }
      if (hasCryptoContribution) {
        waysToContribute.push({
          key: 'crypto',
          Component: ContributeCrypto,
          componentProps: {
            collective,
            hideContributors: true, // for the MVP we shall not display the financial contributors for crypto
            hideCTA: true,
          },
        });
      }
    } else {
      waysToContribute.push({
        key: tier.id,
        Component: ContributeTier,
        componentProps: {
          collective,
          tier,
          hideContributors: true,
          hideCTA: true,
          enableEditing: true,
        },
      });
    }
  });

  return waysToContribute;
};

const CardsContainer = styled(Grid).attrs({
  gridGap: '30px',
  justifyContent: ['center', 'space-between'],
  gridTemplateColumns: [
    'minmax(280px, 400px)',
    'repeat(2, minmax(280px, 350px))',
    'repeat(3, minmax(240px, 350px))',
    'repeat(3, minmax(280px, 350px))',
    'repeat(4, 280px)',
  ],
})`
  & > * {
    padding: 0;
  }
`;

// TODO: Make sure this query works with organizations
const tiersQuery = gql`
  query AccountTiers($accountSlug: String!) {
    account(slug: $accountSlug) {
      id
      ... on AccountWithContributions {
        tiers {
          nodes {
            id
            legacyId
            name
            slug
            description
            interval
            frequency
            amount {
              valueInCents
              currency
            }
            minimumAmount {
              valueInCents
              currency
            }
            goal {
              valueInCents
              currency
            }
            amountType
            endsAt
            type
            maxQuantity
            presets
            button
            useStandalonePage
          }
        }
      }
    }
  }
`;

/**
 * A revamp of `components/edit-collective/sections/Tiers.js`. Meant to be renamed once we'll be ready
 * to replace the old tiers form.
 */
const TiersRevamp = ({ collective }) => {
  const variables = { accountSlug: collective.slug };
  const { data, loading, error } = useQuery(tiersQuery, { variables, context: API_V2_CONTEXT });
  const tiers = get(data, 'account.tiers.nodes', []);
  const intl = useIntl();

  return (
    <div>
      <Grid gridTemplateColumns={['1fr', '172px 1fr']} gridGap={62} mt={34}>
        <Box>
          <Image src="/static/images/tiers-graphic.png" alt="" width={172} height={145} layout="fixed" />
        </Box>
        <Box ml={2}>
          <P>
            <Strong>
              <FormattedMessage defaultMessage="About contribution tiers" />
            </Strong>
            <br />
            <br />
            <Span>
              <FormattedMessage defaultMessage="You can provide perks or rewards for your tiers, have a set membership fee, or create categories for your contributors. Tiers can be limited to an amount or frequency (one time, monthly, yearly), or allowed to be flexibly set by contributors." />
            </Span>
          </P>
          <P mt={3}>
            <StyledLink
              href="https://docs.opencollective.com/help/collectives/collective-settings/tiers-goals"
              openInNewTab
            >
              <FormattedMessage defaultMessage="Learn more about tiers" />.
            </StyledLink>
          </P>
        </Box>
      </Grid>
      <StyledHr my={4} borderColor="black.300" />

      <Box mt={4}>
        {loading ? (
          <LoadingPlaceholder height={500} width="100%" />
        ) : error ? (
          <MessageBoxGraphqlError error={error} />
        ) : (
          <div>
            <Box mb={4}>
              <P fontSize="14px" lineHeight="20x" mb={3}>
                <FormattedMessage defaultMessage="The custom contribution adds a default tier on your collective that doesn't enforce any minimum amount or interval. This is the easiest way for people to contribute to your Collective, but it cannot be customized." />
              </P>
              <Mutation
                mutation={editAccountSettingsMutation}
                refetchQueries={[{ query: collectiveSettingsV1Query, variables: { slug: collective.slug } }]}
                awaitRefetchQueries
              >
                {(editSettings, { loading }) => (
                  <StyledCheckbox
                    name="custom-contributions"
                    label={intl.formatMessage({
                      id: 'tier.customContributions.label',
                      defaultMessage: 'Enable flexible contributions',
                    })}
                    defaultChecked={!get(collective, 'settings.disableCustomContributions', false)}
                    width="auto"
                    isLoading={loading}
                    onChange={({ target }) => {
                      editSettings({
                        variables: {
                          account: { legacyId: collective.id },
                          key: 'disableCustomContributions',
                          value: !target.value,
                        },
                        context: API_V2_CONTEXT,
                      });
                    }}
                  />
                )}
              </Mutation>
            </Box>
            <AdminContributeCardsContainer
              collective={collective}
              cards={getFinancialContributions(collective, tiers)}
              CardsContainer={CardsContainer}
              useTierModals
              enableReordering={false}
            />
          </div>
        )}
      </Box>
    </div>
  );
};

TiersRevamp.propTypes = {
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
  }).isRequired,
};

export default TiersRevamp;
