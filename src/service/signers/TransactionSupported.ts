import { VoteOption } from '../../models/Transaction';

export interface TransactionUnsigned {
  memo: string;
  accountNumber: number;
  accountSequence: number;
}

export interface TransferTransactionUnsigned extends TransactionUnsigned {
  fromAddress: string;
  toAddress: string;
  amount: string;
}

export interface VoteTransactionUnsigned extends TransactionUnsigned {
  voter: string;
  option: VoteOption;
  proposalID: string;
}

export interface NFTTransferUnsigned extends TransactionUnsigned {
  tokenId: string;
  denomId: string;
  sender: string;
  recipient: string;
}

export interface NFTMintUnsigned extends TransactionUnsigned {
  tokenId: string;
  denomId: string;
  name: string;
  uri: string;
  data: string;
  sender: string;
  recipient: string;
}

export interface DelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
  amount: string;
}

export interface WithdrawStakingRewardUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
}

export interface UndelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  validatorAddress: string;
  amount: string;
}

export interface RedelegateTransactionUnsigned extends TransactionUnsigned {
  delegatorAddress: string;
  sourceValidatorAddress: string;
  destinationValidatorAddress: string;
  amount: string;
}

export interface CustomFeeRequest {
  fee: string;
  gasLimit: string;
}
