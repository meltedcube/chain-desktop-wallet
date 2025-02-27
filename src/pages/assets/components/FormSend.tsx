import React, { useEffect, useState, useRef } from 'react';
import './FormSend.less';
import 'antd/dist/antd.css';
import { Button, Form, Input, InputNumber } from 'antd';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useTranslation } from 'react-i18next';

import { AddressType } from '@crypto-org-chain/chain-jslib/lib/dist/utils/address';
import numeral from 'numeral';
import ModalPopup from '../../../components/ModalPopup/ModalPopup';
import { walletService } from '../../../service/WalletService';
import SuccessModalPopup from '../../../components/SuccessModalPopup/SuccessModalPopup';
import ErrorModalPopup from '../../../components/ErrorModalPopup/ErrorModalPopup';
import PasswordFormModal from '../../../components/PasswordForm/PasswordFormModal';
import NoticeDisclaimer from '../../../components/NoticeDisclaimer/NoticeDisclaimer';
import RowAmountOption from '../../../components/RowAmountOption/RowAmountOption';
import { secretStoreService } from '../../../storage/SecretStoreService';
import {
  getAssetAmountInFiat,
  getAssetBalancePrice,
  scaledBalance,
  UserAsset,
  UserAssetType,
} from '../../../models/UserAsset';
import { Session } from '../../../models/Session';
import { allMarketState, ledgerIsExpertModeState } from '../../../recoil/atom';
import { BroadCastResult } from '../../../models/Transaction';
import { TransactionUtils } from '../../../utils/TransactionUtils';
import {
  adjustedTransactionAmount,
  fromScientificNotation,
  getCurrentMinAssetAmount,
  getNormalScaleAmount,
} from '../../../utils/NumberUtils';
import { FIXED_DEFAULT_FEE, SUPPORTED_CURRENCY } from '../../../config/StaticConfig';
import { detectConditionsError, LEDGER_WALLET_TYPE } from '../../../service/LedgerService';
import {
  AnalyticsActions,
  AnalyticsCategory,
  AnalyticsService,
  AnalyticsTxType,
} from '../../../service/analytics/AnalyticsService';

const layout = {};
const tailLayout = {};

interface FormSendProps {
  walletAsset: UserAsset | undefined;
  setWalletAsset: React.Dispatch<React.SetStateAction<UserAsset | undefined>>;
  currentSession: Session;
}

const FormSend: React.FC<FormSendProps> = props => {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState({ recipientAddress: '', amount: '', memo: '' });
  const [isConfirmationModalVisible, setIsVisibleConfirmationModal] = useState(false);
  const [isSuccessTransferModalVisible, setIsSuccessTransferModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadCastResult>({});
  const [isErrorTransferModalVisible, setIsErrorTransferModalVisible] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [inputPasswordVisible, setInputPasswordVisible] = useState(false);
  const [decryptedPhrase, setDecryptedPhrase] = useState('');
  const [availableBalance, setAvailableBalance] = useState('--');
  const [ledgerIsExpertMode, setLedgerIsExpertMode] = useRecoilState(ledgerIsExpertModeState);
  const didMountRef = useRef(false);
  const allMarketData = useRecoilValue(allMarketState);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { walletAsset, setWalletAsset, currentSession } = props;

  const analyticsService = new AnalyticsService(currentSession);

  const [t] = useTranslation();

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      analyticsService.logPage('Send');
    }
  }, []);

  const getTransactionFee = (asset: UserAsset) => {
    const { assetType, config } = asset;

    if (config !== undefined) {
      const { fee } = config;
      if (assetType === UserAssetType.TENDERMINT) {
        return fee.networkFee ?? FIXED_DEFAULT_FEE;
      }
    }
    return FIXED_DEFAULT_FEE;
  };

  const showConfirmationModal = () => {
    setInputPasswordVisible(false);
    const transferInputAmount = adjustedTransactionAmount(
      form.getFieldValue('amount'),
      walletAsset!,
      getTransactionFee(walletAsset!),
    );
    setFormValues({
      ...form.getFieldsValue(),
      // Replace scientific notation to plain string values
      amount: fromScientificNotation(transferInputAmount),
    });
    setIsVisibleConfirmationModal(true);
  };

  const showPasswordInput = () => {
    if (decryptedPhrase || currentSession.wallet.walletType === LEDGER_WALLET_TYPE) {
      showConfirmationModal();
    } else {
      setInputPasswordVisible(true);
    }
  };

  const onWalletDecryptFinish = async (password: string) => {
    const phraseDecrypted = await secretStoreService.decryptPhrase(
      password,
      currentSession.wallet.identifier,
    );
    setDecryptedPhrase(phraseDecrypted);
    showConfirmationModal();
  };

  const onConfirmTransfer = async () => {
    const memo = formValues.memo !== null && formValues.memo !== undefined ? formValues.memo : '';
    const { walletType } = currentSession.wallet;
    if (!decryptedPhrase && walletType !== LEDGER_WALLET_TYPE) {
      return;
    }
    try {
      setConfirmLoading(true);

      const sendResult = await walletService.sendTransfer({
        toAddress: formValues.recipientAddress,
        amount: formValues.amount,
        asset: walletAsset!,
        memo,
        decryptedPhrase,
        walletType,
      });

      analyticsService.logTransactionEvent(
        broadcastResult.transactionHash as string,
        formValues.amount,
        AnalyticsTxType.TransferTransaction,
        AnalyticsActions.FundsTransfer,
        AnalyticsCategory.Transfer,
      );

      setBroadcastResult(sendResult);

      setIsVisibleConfirmationModal(false);
      setConfirmLoading(false);
      setIsSuccessTransferModalVisible(true);
      setInputPasswordVisible(false);
      //   const currentWalletAsset = await walletService.retrieveDefaultWalletAsset(currentSession);
      //   setWalletAsset(currentWalletAsset);

      form.resetFields();
    } catch (e) {
      if (walletType === LEDGER_WALLET_TYPE) {
        setLedgerIsExpertMode(detectConditionsError(e.toString()));
      }

      setErrorMessages(e.message.split(': '));
      setIsVisibleConfirmationModal(false);
      setConfirmLoading(false);
      setInputPasswordVisible(false);
      setIsErrorTransferModalVisible(true);
      // eslint-disable-next-line no-console
      console.log('Error occurred while transfer', e);
    }
  };

  const handleCancel = () => {
    setIsVisibleConfirmationModal(false);
  };

  const closeSuccessModal = () => {
    setIsSuccessTransferModalVisible(false);
  };

  const closeErrorModal = () => {
    setIsErrorTransferModalVisible(false);
  };

  const currentMinAssetAmount = getCurrentMinAssetAmount(walletAsset!);
  const maximumSendAmount = availableBalance;

  const customAddressValidator = TransactionUtils.addressValidator(
    currentSession,
    walletAsset!,
    AddressType.USER,
  );

  const customAmountValidator = TransactionUtils.validTransactionAmountValidator();
  const customMaxValidator = TransactionUtils.maxValidator(
    maximumSendAmount,
    t('send.formSend.amount.error1'),
  );
  const customMinValidator = TransactionUtils.minValidator(
    fromScientificNotation(currentMinAssetAmount),
    `${t('send.formSend.amount.error2')} ${fromScientificNotation(currentMinAssetAmount)} ${
      walletAsset?.symbol
    }`,
  );

  useEffect(() => {
    setAvailableBalance(scaledBalance(walletAsset!));
  }, [walletAsset]);

  const assetMarketData =
    allMarketData[`${currentSession?.activeAsset?.mainnetSymbol}-${currentSession.currency}`];
  const localFiatSymbol = SUPPORTED_CURRENCY.get(assetMarketData.currency)?.symbol;

  return (
    <Form
      {...layout}
      layout="vertical"
      form={form}
      name="control-ref"
      onFinish={showPasswordInput}
      requiredMark={false}
      className="form-send"
    >
      <Form.Item
        name="recipientAddress"
        label={t('send.formSend.recipientAddress.label')}
        hasFeedback
        validateFirst
        rules={[
          {
            required: true,
            message: `${t('send.formSend.recipientAddress.label')} ${t('general.required')}`,
          },
          customAddressValidator,
        ]}
      >
        <Input placeholder={t('send.formSend.recipientAddress.placeholder')} />
      </Form.Item>
      <div className="amount">
        <Form.Item
          name="amount"
          label={t('send.formSend.amount.label')}
          hasFeedback
          validateFirst
          rules={[
            {
              required: true,
              message: `${t('send.formSend.amount.label')} ${t('general.required')}`,
            },
            {
              pattern: /[^0]+/,
              message: `${t('send.formSend.amount.label')} ${t('general.cannot0')}`,
            },
            customAmountValidator,
            customMaxValidator,
            customMinValidator,
          ]}
        >
          <InputNumber />
        </Form.Item>
        <div className="available">
          <span>{t('general.available')}: </span>
          <div className="available-amount">
            {availableBalance} {walletAsset?.symbol}{' '}
            {walletAsset
              ? `(${localFiatSymbol}${numeral(
                  getAssetBalancePrice(walletAsset, assetMarketData),
                ).format('0,0.00')})`
              : ''}
          </div>
        </div>
      </div>
      <RowAmountOption walletAsset={walletAsset!} form={form} />
      <Form.Item name="memo" label={t('send.formSend.memo.label')}>
        <Input />
      </Form.Item>
      <Form.Item>
        <NoticeDisclaimer>
          {t('send.formSend.disclaimer', {
            assetSymbol: walletAsset?.symbol,
            assetName: walletAsset?.name,
          })}
        </NoticeDisclaimer>
      </Form.Item>
      <Form.Item {...tailLayout}>
        <ModalPopup
          isModalVisible={isConfirmationModalVisible}
          handleCancel={handleCancel}
          handleOk={onConfirmTransfer}
          confirmationLoading={confirmLoading}
          button={
            <Button type="primary" htmlType="submit">
              {t('general.continue')}
            </Button>
          }
          okText="Confirm"
          footer={[
            <Button
              key="submit"
              type="primary"
              loading={confirmLoading}
              onClick={onConfirmTransfer}
            >
              {t('general.confirm')}
            </Button>,
            <Button key="back" type="link" onClick={handleCancel}>
              {t('general.cancel')}
            </Button>,
          ]}
        >
          <>
            <div className="title">{t('send.modal1.title')}</div>
            <div className="description">{t('send.modal1.description')}</div>
            <div className="item">
              <div className="label">{t('send.modal1.label1')}</div>
              <div className="address">{`${currentSession.activeAsset?.address ||
                currentSession.wallet.address}`}</div>
            </div>
            <div className="item">
              <div className="label">{t('send.modal1.label2')}</div>
              <div className="address">{`${formValues?.recipientAddress}`}</div>
            </div>
            <div className="item">
              <div className="label">{t('send.modal1.label3')}</div>
              <div>
                {`${formValues?.amount} ${walletAsset?.symbol}`}{' '}
                {walletAsset
                  ? `(${localFiatSymbol}${numeral(
                      getAssetAmountInFiat(formValues?.amount, assetMarketData),
                    ).format('0,0.00')})`
                  : ''}
              </div>
            </div>
            {walletAsset?.assetType !== UserAssetType.EVM ? (
              <div className="item">
                <div className="label">{t('send.modal1.label4')}</div>
                <div>{`~${getNormalScaleAmount(getTransactionFee(walletAsset!), walletAsset!)} ${
                  walletAsset?.symbol
                }`}</div>
              </div>
            ) : (
              <></>
            )}
            <div className="item">
              <div className="label">{t('send.modal1.label5')}</div>
              {formValues?.memo !== undefined &&
              formValues?.memo !== null &&
              formValues.memo !== '' ? (
                <div>{`${formValues?.memo}`}</div>
              ) : (
                <div>--</div>
              )}
            </div>
          </>
        </ModalPopup>

        <PasswordFormModal
          description={t('general.passwordFormModal.description')}
          okButtonText={t('general.passwordFormModal.okButton')}
          onCancel={() => {
            setInputPasswordVisible(false);
          }}
          onSuccess={onWalletDecryptFinish}
          onValidatePassword={async (password: string) => {
            const isValid = await secretStoreService.checkIfPasswordIsValid(password);
            return {
              valid: isValid,
              errMsg: !isValid ? t('general.passwordFormModal.error') : '',
            };
          }}
          successText={t('general.passwordFormModal.success')}
          title={t('general.passwordFormModal.title')}
          visible={inputPasswordVisible}
          successButtonText={t('general.continue')}
          confirmPassword={false}
        />

        <SuccessModalPopup
          isModalVisible={isSuccessTransferModalVisible}
          handleCancel={closeSuccessModal}
          handleOk={closeSuccessModal}
          title={t('general.successModalPopup.title')}
          button={null}
          footer={[
            <Button key="submit" type="primary" onClick={closeSuccessModal}>
              {t('general.ok')}
            </Button>,
          ]}
        >
          <>
            {broadcastResult?.code !== undefined &&
            broadcastResult?.code !== null &&
            broadcastResult.code === walletService.BROADCAST_TIMEOUT_CODE ? (
              <div className="description">
                {t('general.successModalPopup.timeout.description')}
              </div>
            ) : (
              <div className="description">
                {t('general.successModalPopup.transfer.description')}
              </div>
            )}
            {/* <div className="description">{broadcastResult.transactionHash ?? ''}</div> */}
          </>
        </SuccessModalPopup>
        <ErrorModalPopup
          isModalVisible={isErrorTransferModalVisible}
          handleCancel={closeErrorModal}
          handleOk={closeErrorModal}
          title={t('general.errorModalPopup.title')}
          footer={[]}
        >
          <>
            <div className="description">
              {t('general.errorModalPopup.transfer.description')}
              <br />
              {errorMessages
                .filter((item, idx) => {
                  return errorMessages.indexOf(item) === idx;
                })
                .map((err, idx) => (
                  <div key={idx}>- {err}</div>
                ))}
              {ledgerIsExpertMode ? <div>{t('general.errorModalPopup.ledgerExportMode')}</div> : ''}
            </div>
          </>
        </ErrorModalPopup>
      </Form.Item>
    </Form>
  );
};

export default FormSend;
