#!/bin/bash
set -euo pipefail

function die {
  echo "Error: $@"
  exit 1
}

# image regular expression.
# e.g. 123456.dkr.ecr.eu-west-1.amazonaws.com/aws-ecr-example/example:1.2.3
#      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^
#      registry                               name                    tag
# NB the tag is optional.
IMAGE_REGEX='^([^\/]+)\/([^:]+)(:([^:]+))?$'

# validate the source image.
if [[ "$ECR_IMAGE_SOURCE_IMAGE" =~ $IMAGE_REGEX ]]; then
  source_registry="${BASH_REMATCH[1]}"
  source_name="${BASH_REMATCH[2]}"
  source_tag="${BASH_REMATCH[4]}"
  source_image="$source_registry/$source_name:$source_tag"
  if [ -z "$source_tag" ]; then
    die "Source image must have a tag."
  fi
else
  die "Invalid source image format."
fi

# validate the target image.
if [[ "$ECR_IMAGE_TARGET_IMAGE" =~ $IMAGE_REGEX ]]; then
  target_registry="${BASH_REMATCH[1]}"
  target_name="${BASH_REMATCH[2]}"
  target_tag="${BASH_REMATCH[4]:-$source_tag}"
  target_image="$target_registry/$target_name:$target_tag"
  if [[ ! $target_registry =~ \.amazonaws.com$ ]]; then
    die "The target image is not an Amazon ECR repository."
  fi
else
  die "Invalid target image format."
fi

# login into the target ecr.
aws ecr get-login-password \
  --region "$ECR_IMAGE_TARGET_REGION" \
  | crane auth login \
    --username AWS \
    --password-stdin \
    "$target_registry"

# manage the image.
case "$ECR_IMAGE_COMMAND" in
  create)
    crane copy \
      --allow-nondistributable-artifacts \
      "$source_image" \
      "$target_image"
    ;;
  delete)
    # TODO make this idempotent by ignoring the following error:
    #       MANIFEST_UNKNOWN: Requested image not found
    #      see https://github.com/google/go-containerregistry/issues/1862
    crane delete \
      "$target_image"
    ;;
  *)
    die "Unknown $ECR_IMAGE_COMMAND command."
    ;;
esac
