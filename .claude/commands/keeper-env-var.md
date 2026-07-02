---
description: Add new Keeper environment variable record
---

# Keeper Environment Variable Record

Execute keeper cli command to add a new encrypted note record to "Environment Variables" folder. This is a strict command. Follow this exactly.

## Arguments

All optional

$ARGUMENTS[0] — Variable Name
$ARGUMENTS[1] — Value
$ARGUMENTS[2] — Environment
$ARGUMENTS[3] — Service

If all arguments are passed, skip step 1

## Steps:

1. **User Prompts** — Gather information from the user that will be used to create the keeper command:

### User Prompts

After this command is invoked, prompt the user for the following information

#### Variable Name

"Environment variable name:"

#### Value

"Value:"

#### Environment

"Target environment:"

Allowed options:

- development
- acceptance
- production

#### Service

"Service:"

Allowed options:

- Content Service
- GitHub Secrets
- Lead Service
- Location Service
- PIM Proxy
- Portal Service
- Product Service
- Sales Service
- Search Service
- Website Dynamic
- Website Static

2. **Format Data** — Using the data provided by the user, format it to be used in the keeper cli command:

- Variable Name
  - If a plain text variable name is supplied, take that name and transform it to be all uppercase whitespaces swapped for `_`
  - Ensure no leading or trailing white space
  - Ensure no leading or trailing `_`
  - Prefix the variable name with either `[DEV] `, `[ACC] ` or `[PRD] ` based on the environment they selected
  - Double check before running the keeper command

3. **Keeper CLI Login** -

Ensure the user has authenticated with keeper. You may need to run `keeper login` and follow the steps to login. Prompt them for their email address which will be needed for the login.

If prompted for SSO login, select option `o` to open the login in a browser. Make sure you directly open the browser on SSO page for the user to copy their token. Allow the user to paste the auth token back to you to be used to login via option `p`

If there are issues with the login, then prompt the user to run `keeper login` in a separate terminal and wait for them to complete the login before continuing.

<!-- How can I get copliot/vclaued to follow the login process? -->

4. **Fetch Folder UID** — Find the UID for the folder we will add the new record to

Follow this exactly.

Run the following in order to find the target folder:

```
keeper ls "Environment Variables"
```

Based on the environment selected by the user, run

```
keeper ls -l "Environment Variables/1 Dev"
```

(Options: 1 Dev, 2 Acc, 3 Prd, 4 Localhost)

Find the matching service in the list returned anf find the UID - we will use this in the command to add a new record

5. **Generate Command** — Using the transformed data, generate the command that will be executed

The command will follow this format:

```
keeper record-add --title "<variable-name>" --record-type encryptedNotes --folder <folder-uid> note=<value> --force
```

6. **Present a brief overview to the user** — Include:

   - The details they provided (after being transformed if apllicable)
   - The keeper command that will be executed
   - The target path of the new record

   Example output:

   ```
   Overview
   Variable name: [PRD] MY_NEW_ENV_VAR
   Value: "Y/a3c~C9M7~pXL||{m,
   Environment: development
   Service: GitHub Secrets

   Path: Environment Variables/3 Prd/GitHub Secrets/[PRD] MY_NEW_ENV_VAR
   ```

7. **Execute Command**
   Run the keeper cli command to add the new record and return success/failure message

## Rules

- **Never run the keeper record add command without permission** — that's the whole point of this command
