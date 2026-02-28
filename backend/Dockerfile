# build the frontend with Node/Vite
FROM node:22 AS frontend-builder
WORKDIR /frontend

# copy package definition first to install dependencies
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.* ./
COPY frontend/index.html ./
COPY frontend/src ./src

RUN npm install --silent
RUN npm run build

# -----------------------------------------------------------------------------
# final image with FastAPI and static files
FROM python:3.12
WORKDIR /code

COPY backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY backend/app /code/app

# copy built static assets from the fron    tend stage
COPY --from=frontend-builder /frontend/dist /code/app/static

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]