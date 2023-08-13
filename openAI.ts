import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
export const openAI = new OpenAIApi(configuration);

export class SemantleBot {
  private messages: ChatCompletionRequestMessage[] = [];
  private async chat(message: ChatCompletionRequestMessage) {
    const RETRY_COUNT = 3;

    for (let i = 0; i < RETRY_COUNT; i++) {
      try {
        const nextMessages = message
          ? [...this.messages, message]
          : this.messages;
        const { data } = await openAI.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: nextMessages,
        });

        const answer = data.choices[0];

        if (!answer.message?.content) {
          throw new Error("No answer");
        }

        this.messages = [...nextMessages, answer.message];

        return answer.message.content;
      } catch (error) {
        if (error.response?.data?.error?.code === "context_length_exceeded") {
          this.messages = this.messages.filter((message, i) => {
            if (message.role === "assistant") {
              const nextMessage = this.messages[i + 1];
              if (!nextMessage || nextMessage.role !== "system") {
                return true;
              }
              const contents = nextMessage.content?.split(" - ");
              return contents && Number(contents[1]) >= 30;
            }
            return true;
          });
          this.messages = this.messages.filter((message, i) => {
            if (message.role === "system") {
              const prevMessage = this.messages[i - 1];

              return !prevMessage || prevMessage.role === "assistant";
            }
            return true;
          });
          console.log(this.messages);
          continue;
        }
        throw error;
      }
    }
    throw new Error("Retry count exceeded");
  }

  async start() {
    const result = await this.chat({
      role: "system",
      content: `
      You are a player in a game of word similarity.
      You're goal is to guess the answer word based on the similarity score of the previous word.
      
      Here is how the game works:
      - The similarity score is a number between -100 and +100, which is calculated based on how similar the word you guessed is to the answer word.
      - The answer word is a Korean word that is at least two characters long. It can be a noun, verb, adjective, or any other part of speech, but only the base form of the word is considered.
      - The answer word is randomly selected from a list of frequently used Korean words on Wiktionary. All answer words are at least two characters long, but you can guess one-character words for strategic reasons.
      - The similarity score is not based on the spelling of the word, but on how similar it is in terms of meaning. Think of it as how likely the word you guessed will be mentioned in the same paragraph or sentence as the answer word.
      - Even if they have opposite meanings, words like 'love' and 'hate' often have similar similarity scores because they are frequently used in the same context.

      Here is how you play the game:

      Step 1. You start by guessing a word.
      Step 2. I will provide you with the similarity score of that word in the form of "word - similarity - rank". ex) 사랑 - 23.5 - 500
      Step 3. You guess the next word based on the similarity score I provided. ex) "행복"

      Here are the rules of the game:

      - Game accepts only Korean words.
      - You MUST always say the following when you say a word. "The next word to guess is "단어"."
      - You MUST NOT say the word you guessed before until the answer is revealed.
      - You MUST NOT end the game until you guess the answer.
      - You MUST guess the word based on the the highest similarity score I provided.

      If you understand the rules, say the first word to guess. ex) "The next word to guess is "단어"."
    `,
    });

    return result.match(/"(.+)"/)?.[1] ?? "";
  }

  async guessNextWord(prevWord: string, similarity: number, rank: string) {
    const nextWord = await this.chat({
      role: "system",
      content: `${prevWord} - ${similarity} - ${rank}`,
    });

    return nextWord.match(/"(.+)"/)?.[1] ?? "";
  }
}
