import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { LanguageModel } from 'ai';

/**
 * Builds a Bedrock language model that uses the full AWS SDK credential
 * chain — so `AWS_PROFILE` (including SSO profiles), EC2 instance roles,
 * ECS task roles, and raw `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env
 * vars all work the same way they do with the AWS CLI.
 *
 * The Vercel AI SDK's Bedrock provider ships with a lightweight SigV4 signer
 * (`aws4fetch`) for edge-runtime compatibility, which only reads env var
 * credentials. This wrapper swaps in the Node SDK's credential provider so
 * profile/SSO/IMDS flows work in local dev and on AWS hosts.
 *
 * `AWS_REGION` is still required since Bedrock is regional.
 */
export function createBedrockModel(modelId: string): LanguageModel {
  const bedrock = createAmazonBedrock({
    credentialProvider: fromNodeProviderChain(),
  });
  return bedrock(modelId);
}
