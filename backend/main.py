from fastapi import FastAPI
import httpx


app = FastAPI()


async def call_satellite_api(url: str):
    r = httpx.get(url)
    print(r.status_code)
    print(r.headers["content-type"])
    return r.text


@app.get("/")
def read_root():
    return {"Hello": "World"}
