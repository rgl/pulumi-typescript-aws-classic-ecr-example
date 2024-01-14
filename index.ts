import * as pulumi from "@pulumi/pulumi";
import { createImages } from "./images";

// see https://www.pulumi.com/docs/concepts/config/
const awsConfig = new pulumi.Config("aws");
const config = new pulumi.Config();
const region = awsConfig.require("region");
const project = config.get("project") ?? pulumi.getProject();
const environment = config.get("environment") ?? pulumi.getStack();

// the default tags that are manually applied to all resources.
// TODO do this at the provider level.
const defaultTags = {
    project: project,
    environment: environment,
}

// the source images.
// object value: source image uri.
// object key: target repository name suffix (project used as name suffix).
const sourceImages = {
    "example": "docker.io/ruilopes/example-docker-buildx-go:v1.10.0",
    "hello-etcd": "ghcr.io/rgl/hello-etcd:0.0.1",
}

export const images = createImages(region, project, sourceImages, defaultTags);

export const registryDomain = images.example.apply(uri => new URL("uri://" + uri).host);

export const registryRegion = region;
