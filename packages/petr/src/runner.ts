import { createObjectCsvWriter } from 'csv-writer';
import { BaseLanguageModel } from 'langchain/base_language';
import { LLMChain } from 'langchain/chains';
import { ConditionalPromptSelector } from 'langchain/prompts';

/**
 * Duplicated from csv-writer as the types are not exported
 */
type ObjectHeaderItem = { id: string; title: string };
type ObjectStringifierHeader = ObjectHeaderItem[] | string[];

interface ObjectCsvWriterParams {
  path: string;
  header: ObjectStringifierHeader;
  fieldDelimiter?: string;
  recordDelimiter?: string;
  headerIdDelimiter?: string;
  alwaysQuote?: boolean;
  encoding?: string;
  append?: boolean;
}

export type ModelOption = { name: string; llm: BaseLanguageModel };

export type RunnerParams<
  TInput extends Record<string, any>,
  TOutput extends Record<string, string>
> = {
  /** The prompt to pass into the chain */
  prompt: ConditionalPromptSelector;
  /** The input data to run over */
  data: TInput[];
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
  /**
   * Converter to turn the output of the chain into what is written into the
   * CSV file. By default, it just combines the input and output data.
   * @param inputData The input data
   * @param outputData The output data from the chains
   * @returns
   */
  outputConverter?: (
    inputData: TInput,
    outputData: Record<string, any>
  ) => TOutput;
  /**
   * Any additional parameters to pass into the CSV writer
   */
  csvParams: Partial<ObjectCsvWriterParams>;
  models: ModelOption[];
};

/**
 * Creates the CSV Writer to use for the runner based on the provided input
 * parameters.
 * @returns
 */
function getCSVWriter<
  TInput extends Record<string, any>,
  TOutput extends Record<string, any>
>({
  csvParams,
  data,
  models,
  outputConverter,
}: Required<
  Pick<
    RunnerParams<TInput, TOutput>,
    'csvParams' | 'data' | 'outputConverter' | 'models'
  >
>) {
  const fakeOutput: Record<string, any> = {};
  models.forEach(({ name }) => (fakeOutput[name] = ''));

  return createObjectCsvWriter({
    path: 'output.csv', // Default output file name, if not specified
    ...csvParams,
    header: csvParams.header?.length
      ? csvParams.header
      : Object.keys(outputConverter(data[0], fakeOutput)).map((val) => ({
          id: val,
          title: val.toUpperCase(),
        })),
  });
}

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

  const csvWriter = getCSVWriter({ csvParams, data, models, outputConverter });

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
    break;
  }

  console.log('Finished!');
  return { results };
}
