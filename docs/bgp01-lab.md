# BGP01 Lab Guide

The topology contains three FRRouting nodes arranged in a line: **r1 – r2 – r3**.  
Each node advertises its loopback /32 over BGP.

## Tasks

1. **Verify FRR service**
   ```bash
   sudo systemctl status frr --no-pager
   ```
   If FRR is not running, start it with `sudo systemctl restart frr`.
2. **Verify interface state**
   ```bash
   ip addr show eth1
   ```
3. **Inspect BGP neighbours**
   ```bash
   vtysh -c "show ip bgp summary"
   ```
4. **Check advertised routes**
   ```bash
   vtysh -c "show ip bgp"
   ```
5. **Traceroute across the lab**
   ```bash
   traceroute 10.0.3.3
   ```

## Default Credentials

| Node | User | Password |
|------|------|----------|
| r1/r2/r3 | `clab` | `clab` |

## Notes

- Containers are built from `quay.io/frrouting/frr:9.1.0`.
- SSH is enabled inside each node via `node-init.sh`.
- The frontend connects through the `/ws/sshterm/{node}` WebSocket which proxies to the SSH service.
- If FRR refuses to start, check `/etc/frr/daemons` inside the node and ensure `zebra=yes` and `bgpd=yes` are set.
