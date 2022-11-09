tar cf - * | kubectl exec -i -n services `kubectl get pods -n services -l app=rollout-mgr -o jsonpath="{.items[0].metadata.name}"` -- tar xf - -C /app/

kubectl exec -n services -i -t $(kubectl get pod -n services -l "app=rollout-mgr" -o name) -- /bin/sh

kubetail -n services -l app=rollout-mgr 


while [ true ]; do
  sum2=`ls -l * | md5`
  if [[ $sum1 != $sum2 ]]; then
    echo "diff - uploading"
    tar cf - * | kubectl exec -i -n services `kubectl get pods -n services -l app=rollout-mgr -o jsonpath="{.items[0].metadata.name}"` -- tar xf - -C /app/
  fi
  sum1=$sum2
  sleep 1
done
