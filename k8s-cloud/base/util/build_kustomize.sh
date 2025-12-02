#!/bin/bash -e

execute_filter=false
execute_kustomize=false

target_product="tfm"
target_stage="*"
target_env="*"
target_app="*"

usage() {
  echo "Usage: ./base/util/build_kustomize.sh [-k] [-f] [-p] <product-optional> [-s] <stage-optional> [-e] <env-optional> [-a] <app-optional>"
  echo "-k: generate only all.yaml"
  echo "-f: generate only crds.yaml and resources.yaml, and delete all.yaml."
  echo "-p <product>: build a specific product (default: tfm)"
  echo "-s <stage>: build a specific stage"
  echo "-e <env>: build a specific env"
  echo "-a <app>: build a specific app"
  echo -e "build_kustomize.sh:\tGenerates k8s manifests using kustomize and filters them into files based on resource type."
  echo -e "\t\t\tIf no flags are passed, it runs both steps."
}

while getopts ':p:s:e:a:kf' opt; do
  case $opt in
    p)
      target_product="$OPTARG"
      ;;
    s)
      target_stage="$OPTARG"
      ;;
    e)
      target_env="$OPTARG"
      ;;
    a)
      target_app="$OPTARG"
      ;;
    f)
      execute_filter=true
      ;;
    k)
      execute_kustomize=true
      ;;
    \?)
      echo -e "Invalid flag passed: -$OPTARG\n"
      usage
      exit 1
      ;;
  esac
done

# If no flags are passed, run both kustomize and filtering
if ! $execute_kustomize && ! $execute_filter; then
  execute_kustomize=true
  execute_filter=true
fi

script_path="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "${script_path}/../.." && pwd)"
base_path="$repo_root/base"
overlay_path="$repo_root"

do_build() {
  app_path="$1"

  if $execute_kustomize; then
    api_versions_arg=()
    if test -f "$app_path/../apiVersions.yaml"; then
      while IFS= read -r api_version; do
        [ -n "$api_version" ] && api_versions_arg+=("--helm-api-versions" "$api_version")
      done < <(awk '/^ *- / {print $2}' "$app_path/../apiVersions.yaml")
    fi

    kustomize build --enable-helm --load-restrictor=LoadRestrictionsNone "${api_versions_arg[@]}" "$app_path" -o "$app_path/all.yaml"
  fi

  if $execute_filter && test -f "$app_path/all.yaml"; then
    yq 'select(.kind != "CustomResourceDefinition")' -o=yaml "$app_path/all.yaml" | tee "$app_path/resources.yaml" >/dev/null
    [[ -s "$app_path/resources.yaml" ]] || rm "$app_path/resources.yaml"

    yq 'select(.kind == "CustomResourceDefinition")' -o=yaml "$app_path/all.yaml" | tee "$app_path/crds.yaml" >/dev/null
    [[ -s "$app_path/crds.yaml" ]] || rm "$app_path/crds.yaml"

    rm "$app_path/all.yaml"
  fi
}

if $execute_kustomize; then
  git config --global --add safe.directory "$repo_root"

  while IFS= read -r chart_path; do
    [ -n "$chart_path" ] || continue

    if (cd "$repo_root" && git check-ignore -q "$chart_path"); then
      rm -rf "$chart_path"
      continue
    fi

    if [[ "$chart_path" =~ \.tgz$ ]]; then
      dest="${chart_path%.tgz}"
      rm -rf "$dest" || true
      mkdir -p "$dest"
      tar -xzf "$chart_path" -C "$dest" --strip-components=1
    fi
  done < <(find "$base_path/charts" -maxdepth 3 -type f -name '*.tgz')
fi

declare -A seen_paths=()
pids=()

candidate_globs=(
  "$overlay_path/$target_product/$target_stage/$target_env/$target_app"
  "$overlay_path/$target_product/$target_stage/$target_app"
)

for glob in "${candidate_globs[@]}"; do
  for app_path in $glob; do
    if test -d "$app_path"; then
      if [[ -n "${seen_paths[$app_path]}" ]]; then
        continue
      fi

      seen_paths[$app_path]=1

      if $execute_filter; then
        echo "${app_path#"$overlay_path/"}"
      fi

      do_build "$app_path" &

      pids+=($!)
    fi
  done
done

for pid in "${pids[@]}"; do
  wait $pid
  status=$?

  if [ "$status" -ne 0 ]; then
    exit $status
  fi
done
