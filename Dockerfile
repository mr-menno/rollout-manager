FROM node:18-alpine
COPY app /app/
WORKDIR /app/
RUN yarn install
ARG CI_COMMIT_SHORT_SHA
ENV COMMIT=${CI_COMMIT_SHORT_SHA}
CMD ["yarn","start"]
#test
