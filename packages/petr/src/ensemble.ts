import { LLMChain } from 'langchain/chains';
import { CSVWriterParams, getCSVWriter } from './csv-writer.js';

type ChainOption = { name: string; chain: LLMChain };

export type EnsembleParams<
  TInput extends Record<string, any>,
  TOutput extends Record<string, string>
> = {
  /**
   * Converter to turn the provided input into something that can be used to
   * call the chain.
   */
  inputConverter?: (data: TInput) => any;
  chains: ChainOption[];
} & Omit<CSVWriterParams<TInput, TOutput>, 'names' | 'outputConverter'> &
  Partial<Pick<CSVWriterParams<TInput, TOutput>, 'outputConverter'>>;

/**
 * Runs a full set of classifications over a set of data a chain to use. This
 * will run it across different chains, and then combine the results into a
 * single CSV file.
 *
 * Unlike the runner which compares different models with different prompts,
 * this will allow you to compare different chains altogether and therefore can
 * be used to ensemble results from different methods.
 */
export async function ensemble<
  TInput extends Record<string, any>,
  TOutput extends Record<string, any>
>({
  data,
  inputConverter = (data: TInput) => data,
  outputConverter = (inputData: TInput, outputData: Record<string, any>) =>
    ({
      ...inputData,
      ...outputData,
    } as TOutput),
  csvParams,
  chains,
}: EnsembleParams<TInput, TOutput>) {
  const csvWriter = getCSVWriter({
    csvParams,
    data,
    names: chains.map((chain) => chain.name),
    outputConverter,
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
