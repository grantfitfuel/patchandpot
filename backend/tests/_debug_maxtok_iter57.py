# Debug: does max_tokens truncate claude-sonnet-5-5 output far earlier than expected?
import asyncio, os
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = "Write exactly 15 numbered sentences about compost, each about 20 words. No preamble."


async def run(model, mt):
    c = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"dbg-{model}-{mt}",
                system_message="You are concise.").with_model("anthropic", model)
    if mt:
        c.with_params(max_tokens=mt)
    r = await c.send_message(UserMessage(text=PROMPT))
    lines = [l for l in r.splitlines() if l.strip()]
    print(f"{model} max_tokens={mt}: chars={len(r)} lines={len(lines)} last={lines[-1][-60:]!r}")


async def main():
    for m, mt in [("claude-sonnet-5-5", 1500), ("claude-sonnet-5-5", 6000), ("claude-sonnet-4-5-20250929", 1500)]:
        try:
            await asyncio.wait_for(run(m, mt), timeout=80)
        except Exception as e:
            print(m, mt, "ERR", repr(e)[:200], flush=True)

asyncio.run(main())
