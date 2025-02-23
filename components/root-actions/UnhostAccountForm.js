import React from 'react';
import { gql, useMutation } from '@apollo/client';
import { useIntl } from 'react-intl';

import { i18nGraphqlException } from '../../lib/errors';
import { API_V2_CONTEXT, gqlV1 } from '../../lib/graphql/helpers';

import CollectivePickerAsync from '../CollectivePickerAsync';
import StyledButton from '../StyledButton';
import StyledInputField from '../StyledInputField';
import { TOAST_TYPE, useToasts } from '../ToastProvider';

const collectivePickerSearchQuery = gqlV1/* GraphQL */ `
  query UnhostAccountSearchQuery($term: String!, $types: [TypeOfCollective], $limit: Int, $hostCollectiveIds: [Int]) {
    search(term: $term, types: $types, limit: $limit, hostCollectiveIds: $hostCollectiveIds) {
      id
      collectives {
        id
        type
        slug
        name
        imageUrl(height: 64)
        isActive
        host {
          id
          slug
          name
        }
      }
    }
  }
`;

const unhostAccountMutation = gql`
  mutation UnhostAccount($account: AccountReferenceInput!) {
    removeHost(account: $account) {
      id
      slug
      name
      ... on AccountWithHost {
        host {
          id
        }
      }
    }
  }
`;

const UnhostAccountForm = () => {
  const [account, setAccount] = React.useState(null);
  const [unhostAccount, { loading }] = useMutation(unhostAccountMutation, { context: API_V2_CONTEXT });
  const { addToast } = useToasts();
  const intl = useIntl();
  return (
    <div>
      <StyledInputField htmlFor="clear-cache-account" label="Account to unhost" flex="1 1">
        {({ id }) => (
          <CollectivePickerAsync
            inputId={id}
            onChange={({ value }) => setAccount(value)}
            types={['COLLECTIVE', 'FUND']}
            searchQuery={collectivePickerSearchQuery}
            filterResults={collectives => collectives.filter(c => Boolean(c.host))}
            collective={account}
            noCache
          />
        )}
      </StyledInputField>
      <StyledButton
        mt={4}
        width="100%"
        buttonStyle="primary"
        disabled={!account}
        loading={loading}
        onClick={async () => {
          if (!account.host) {
            addToast({ type: TOAST_TYPE.ERROR, message: 'This account has no host' });
            return;
          } else if (
            !confirm(
              `You're about to unhost ${account.name} (@${account.slug}) from ${account.host.name} (@${account.host.slug}). Are you sure?`,
            )
          ) {
            return;
          }

          try {
            const result = await unhostAccount({ variables: { account: { legacyId: account.id } } });
            const resultAccount = result.data.removeHost;
            addToast({
              type: TOAST_TYPE.SUCCESS,
              message: `${resultAccount.name} (@${resultAccount.slug}) has been unhosted`,
            });
            setAccount(null);
          } catch (e) {
            addToast({
              type: TOAST_TYPE.ERROR,
              message: i18nGraphqlException(intl, e),
            });
          }
        }}
      >
        Unhost {account ? `${account.name} (@${account.slug})` : ''}
      </StyledButton>
    </div>
  );
};

UnhostAccountForm.propTypes = {};

export default UnhostAccountForm;
