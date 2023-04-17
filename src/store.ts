var store = require('store');
import { SigningClientType } from './granter';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

const SignerStoreKey = 'signer';

export type SignerData = {
  accountNumber: number;
  sequence: number;
  chainId: string;
};

/**
 * Helper function to get the signer sequence from chain, and if it is same
 * as current locally stored one, it means you you want to send another tx while there is
 * already one in progress on chain, thus increment the local sequence by 1 and use it.
 */
export const getSignerData = async (
  signingClient: SigningClientType,
  wallet: DirectSecp256k1HdWallet,
): Promise<SignerData> => {
  let signer: SignerData = store.get(SignerStoreKey);

  if (!signer?.chainId) {
    const chainId = await signingClient.getChainId();
    signer = {
      accountNumber: 0,
      sequence: 0,
      chainId,
    };
  }

  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  const { accountNumber, sequence } = await signingClient.getSequence(address);
  signer.accountNumber = accountNumber;

  if (sequence > signer.sequence) {
    signer.sequence = sequence;
  } else {
    signer.sequence++;
  }

  store.set(SignerStoreKey, signer);
  return signer;
};
