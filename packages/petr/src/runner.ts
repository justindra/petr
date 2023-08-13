import { BaseLanguageModel } from 'langchain/base_language';
import { LLMChain } from 'langchain/chains';
import { ConditionalPromptSelector } from 'langchain/prompts';
import { CSVWriterParams, getCSVWriter } from './csv-writer.js';

export type ModelOption = { name: string; llm: BaseLanguageModel };

export type RunnerParams<
  TInput extends Record<string, any>,
  TOutput extends Record<string, string>
> = {
  /** The prompt to pass into the chain */
  prompt: ConditionalPromptSelector;
  /**
   * A function that loads a chain, given a language model and a conditional
   * prompt selector.
   */
  loadChainFn: (
    llm: BaseLanguageModel,
    prompt: ConditionalPromptSelector
  ) => Promise<LLMChain>;
  /**
   * Converter to turn the provided input into something that can be used to
   * call the chain.
   */
  inputConverter?: (data: TInput) => any;
  models: ModelOption[];
} & Omit<CSVWriterParams<TInput, TOutput>, 'names' | 'outputConverter'> &
  Partial<Pick<CSVWriterParams<TInput, TOutput>, 'outputConverter'>>;

/**
 * Runs a full set of classifications over a set of data given a prompt to use.
 * This will run it across 3 different models, and then combine the results into
 * a single CSV file.
 */
export async function runner<
  TInput extends Record<string, any>,
  TOutput extends Record<string, any>
>({
  prompt,
  data,
  loadChainFn,
  inputConverter = (data: TInput) => data,
  outputConverter = (inputData: TInput, outputData: Record<string, any>) =>
    ({
      ...inputData,
      ...outputData,
    } as TOutput),
  csvParams,
  models,
}: RunnerParams<TInput, TOutput>) {
  const chains = await Promise.all(
    models.map(async ({ name, llm }) => ({
      name,
      chain: await loadChainFn(llm, prompt),
    }))
  );

  const csvWriter = getCSVWriter({
    csvParams,
    data,
    names: models.map((model) => model.name),
    outputConverter: outputConverter as any,
  });

  const results: TOutput[] = [];
  let i = 0;

  for (const datum of data) {
    const input = inputConverter(datum);
    const res: Record<string, any> = {};

    for (const chain of chains) {
      const classification = (await chain.chain.call(input))['output'];
      res[chain.name] = classification;
    }

    const output = outputConverter(datum, res);

    results.push(output as TOutput);
    i++;

    console.log(`Finished ${i} of ${data.length}`);
    await csvWriter.writeRecords([output]);
  }

  console.log('Finished!');
  return { results };
}
