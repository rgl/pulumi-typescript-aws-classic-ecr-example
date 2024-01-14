# About

This creates private container image repositories hosted in the [AWS Elastic Container Registry (ECR)](https://aws.amazon.com/ecr/) of your AWS Account using a pulumi program.

For equivalent examples see:

* [terraform](https://github.com/rgl/terraform-aws-ecr-example)
* [pulumi (aws-native provider)](https://github.com/rgl/pulumi-typescript-aws-native-ecr-example)

# Usage (on a Ubuntu Desktop)

Install the dependencies:

* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
* [Node.js](https://nodejs.org).
* [Pulumi](https://www.pulumi.com/docs/get-started/install/).
* [Crane](https://github.com/google/go-containerregistry/releases).
* [Docker](https://docs.docker.com/engine/install/).

Set the AWS Account credentials using SSO:

```bash
# set the account credentials.
# see https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#sso-configure-profile-token-auto-sso
aws configure sso
# dump the configured profile and sso-session.
cat ~/.aws/config
# set the environment variables to use a specific profile.
export AWS_PROFILE=my-profile
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_DEFAULT_REGION
# show the user, user amazon resource name (arn), and the account id, of the
# profile set in the AWS_PROFILE environment variable.
aws sts get-caller-identity
```

Or, set the account credentials using an access key:

```bash
# set the account credentials.
# NB get these from your aws account iam console.
#    see Managing access keys (console) at
#        https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_CreateAccessKey
export AWS_ACCESS_KEY_ID='TODO'
export AWS_SECRET_ACCESS_KEY='TODO'
# set the default region.
export AWS_DEFAULT_REGION='eu-west-1'
# show the user, user amazon resource name (arn), and the account id.
aws sts get-caller-identity
```

Review `index.ts`.

Set the environment:

```bash
cat >secrets.sh <<'EOF'
export AWS_PROFILE=my-profile
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_DEFAULT_REGION
aws sts get-caller-identity

export PULUMI_SKIP_UPDATE_CHECK='true'
export PULUMI_BACKEND_URL="file://$PWD" # NB pulumi will create the .pulumi sub-directory.
export PULUMI_CONFIG_PASSPHRASE='password'
pulumi stack select dev
EOF
```

Provision:

```bash
# login.
source secrets.sh
pulumi login
pulumi whoami -v
# create the dev stack.
pulumi stack init dev
pulumi stack select dev
# set the region.
pulumi config set aws:region eu-west-1
# provision.
pulumi up
# provision in troubleshooting mode.
# NB for more information see the troubleshooting section in this document.
#pulumi up --logtostderr --logflow -v=9 2>pulumi.log
```

Display the created resources and outputs:

```bash
pulumi stack
```

Log in the container registry:

**NB** You are logging in at the registry level. You are not logging in at the
repository level.

```bash
aws ecr get-login-password \
  --region "$(pulumi stack output registryRegion)" \
  | docker login \
      --username AWS \
      --password-stdin \
      "$(pulumi stack output registryDomain)"
```

**NB** This saves the credentials in the `~/.docker/config.json` local file.

Inspect the created example container images:

```bash
image="$(pulumi stack output --json images | jq -r .example)"
crane manifest "$image" | jq .
```

Download the created example container image from the created container image
repository, and execute it locally:

```bash
docker run --rm "$image"
```

Delete the local copy of the created container image:

```bash
docker rmi "$image"
```

Log out the container registry:

```bash
docker logout \
  "$(pulumi stack output registryDomain)"
```

Delete the example image resource:

```bash
# list the stack, and grab the urn of the example Command, and use
# it in the pulumi destroy command.
pulumi stack --show-urns
pulumi destroy --target 'urn:pulumi:dev::pulumi-typescript-aws-classic-ecr-example::aws:ecr/repository:Repository$command:local:Command::pulumi-typescript-aws-classic-ecr-example/example:v1.10.0'
```

At the ECR AWS Management Console, verify that the example image no longer
exists (actually, it's the image index/tag that no longer exists).

Do an `pulumi up` to verify that it recreates the example image:

```bash
pulumi up
```

Destroy the example:

```bash
pulumi destroy
pulumi stack rm dev
```

# Notes

* Its not possible to create multiple container image registries.
  * A single registry is automatically created when the AWS Account is created.
  * You have to create a separate repository for each of your container images.
    * A repository name can include several path segments (e.g. `hello/world`).
* The Pulumi AWS Classic Provider:
  * Uses [the AWS ECR API](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/Welcome.html) (it does NOT use [CloudFormation](https://docs.aws.amazon.com/cloudformation/)).
  * This provider uses an embedded version of the [Terraform AWS provider](https://github.com/hashicorp/terraform-provider-aws).

# References

* [Environment variables to configure the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
* [Token provider configuration with automatic authentication refresh for AWS IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html) (SSO)
* [Managing access keys (console)](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_CreateAccessKey)
* [AWS General Reference](https://docs.aws.amazon.com/general/latest/gr/Welcome.html)
  * [Amazon Resource Names (ARNs)](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html)
* [Amazon ECR private registry](https://docs.aws.amazon.com/AmazonECR/latest/userguide/Registries.html)
  * [Private registry authentication](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html)
* Pulumi
  * [Configuration](https://www.pulumi.com/docs/concepts/config/)
  * [AWS Classic Provider](https://www.pulumi.com/registry/packages/aws/)
    * [Installation and Configuration](https://www.pulumi.com/registry/packages/aws/installation-configuration/)
    * [Source code](https://github.com/pulumi/pulumi-aws)
  * [Command Provider](https://www.pulumi.com/registry/packages/command/)
