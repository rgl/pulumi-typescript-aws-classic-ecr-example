import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as aws from "@pulumi/aws";

function getMergedDefaultTags(defaultTags: Record<string, string>, tags?: Record<string, string>): Record<string, string> {
    return Object.assign(tags ?? {}, defaultTags);
}

// image regular expression.
// e.g. 123456.dkr.ecr.eu-west-1.amazonaws.com/aws-ecr-example/example:1.2.3
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^
//      registry                               name                    tag
// NB the tag is optional.
const imageRe = /^(?<registry>[^\/]+)\/(?<name>[^:]+)(:(?<tag>[^:]+))?$/;

function getTargetImage(sourceImage: string, targetRepositoryUri: string): string {
    const sourceImageTagMatch = sourceImage.match(imageRe);
    if (!sourceImageTagMatch?.groups?.tag) {
        throw new Error(`cannot extract the tag from the source image ${sourceImage}`);
    }
    const sourceImageTag = sourceImageTagMatch.groups.tag;
    return `${targetRepositoryUri}:${sourceImageTag}`;
}

export function createImages(region: string, project: string, sourceImages: Record<string, string>, tags: Record<string, string>): Record<string, pulumi.Output<string>> {
    const result: Record<string, pulumi.Output<string>> = {};
    for (const [name, sourceImage] of Object.entries(sourceImages)) {
        const sourceImageTagMatch = sourceImage.match(imageRe);
        if (!sourceImageTagMatch?.groups?.tag) {
            throw new Error(`cannot extract the tag from the source image ${sourceImage}`);
        }
        const sourceImageTag = sourceImageTagMatch.groups.tag;
        // see https://www.pulumi.com/registry/packages/aws/api-docs/ecr/repository/
        // see https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_CreateRepository.html
        const repository = new aws.ecr.Repository(`${project}/${name}`, {
            forceDelete: true,
            imageTagMutability: "IMMUTABLE",
            imageScanningConfiguration: {
                scanOnPush: false,
            },
            tags: getMergedDefaultTags(tags),
        });
        const targetImage = repository.repositoryUrl.apply(i => getTargetImage(sourceImage, i));
        // see https://www.pulumi.com/registry/packages/command/
        new command.local.Command(`${project}/${name}:${sourceImageTag}`, {
            interpreter: ["bash", "-c"],
            create: "ECR_IMAGE_COMMAND=copy exec bash ecr-image.sh",
            delete: "ECR_IMAGE_COMMAND=delete exec bash ecr-image.sh",
            environment: {
                ECR_IMAGE_SOURCE_IMAGE: sourceImage,
                ECR_IMAGE_TARGET_IMAGE: targetImage,
                ECR_IMAGE_TARGET_REGION: region,
            },
        }, {
            parent: repository,
        });
        result[name] = targetImage;
    }
    return result;
}
