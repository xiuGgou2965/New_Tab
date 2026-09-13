from fastapi import FastAPI

# 创建应用实例
app = FastAPI()

# 根接口 GET
@app.get("/")
def read_root():
    try:
        with open("./APIdocx.txt", "r", encoding="utf-8") as f:
            msg = f.read()
    except FileNotFoundError:
        msg = "未找到文档,请检查后端文件是否存在."
    return {"msg": msg}


@app.get("/happy")
def read_root():
    return {"msg": "26/9/12_10:40这个后端项目跑起来了"}
