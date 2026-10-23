FROM public.ecr.aws/docker/library/node:22-alpine AS build

WORKDIR /var/task
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY server ./server
RUN npm run build

FROM public.ecr.aws/docker/library/node:22-alpine

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /var/task/server ./server
COPY --from=build /var/task/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
