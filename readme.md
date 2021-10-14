create project in firebase
https://github.com/actions-on-google/assistant-conversation-nodejs
install firebase functions
npm install -g firebase-tools
have to create private key in firebase
by migrating webhooks from in-line to my own server, cut the deployment time from 3 minutes to 48 seconds. by hosting the yaml on my own server, saving , then gactions deploy preview, cut it down to 15 seconds. dont have to wait for it to say done.

to generate pem file, ssh-keygen -m PEM
to ssh into ec2 from local, use ssh -i doc3.pem ubuntu@50.18.72.90 with vs code remote explorer.
to scp do scp -i doc3.pem -r C:\swe\doctorg\ ubuntu@50.18.72.90:/home/ubuntu/doctorg/yamls
have to create the yamls folder first though.

somehow it still works even if webhook is

# httpsEndpoint:

# baseUrl: https://doctorg.anhonestobserver.com

# endpointApiVersion: 2

inlineCloudFunction:
executeFunction: ActionsOnGoogleFulfillment

gactions deploy preview only is a preview, but gactions push uploads everything officially.
best workflow is have my own webhook, but dont use yamls because its harder to visually see.

now trying to migrate to google compute engine because 1 gb memory instead of ec2 .5gb.
randomly did gcloud compute os-login ssh-keys add --key-file=C:\swe\doctorg\doctorg\compute-engine-ssh\doc.pub
after generating ssh key with ssh-keygen, didnt give it an file type.
and it produced sshPublicKeys:
064d7f4f330ea19f2ad6d36d214d5c6f463053881935484a6ca8d7e4a09c493e:
fingerprint: 064d7f4f330ea19f2ad6d36d214d5c6f463053881935484a6ca8d7e4a09c493e
key: |
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC90/zFZ4caJQwTAmrcAjUJEC30V89+2j2lTAJSgbHP8l+9PxYTFc/9BWU3xme8ntq3IV2tJPX5MvWluEnhrHjzs33NtT2ngsw+mMk09aXZjfsMxfVjjRd4Uv7Hc9LLRFUYlyAeBf8RWCRCXcB3ol9E6TDNNRbqUTc/i9oB/cAW4ka9gee9e1VYO/cvfJOdm2adzYh/21P2h4PXTbdQUp9qzJ8Y/RMnzwmJtlpHYlGdqcAvQqj0bk3wquVTQjvx+ze+IsNUl0D+o6mf4Wl22oqVLfLw1a7nDh4WCu5vRXXUZDVUJLpMQ4PKRoPR0MaRexZxDWqtIGiffg4JtXFVo2IVyTgP1SPq5WLqOE0QMFZLxYAu8yIMPL9hcQQaB32tGRrp11YWOBiYrg6c8bzuSKQhH0clLyrGcin4y6IisQJOzs9Zi0LYnANGw0ym8fFvc460WrSAXYZ5WNjz1Ga5Gq/81PGEims81DhMEknBMEhkPNbTFwQuutgAOrTN5PcE+9M= user@DESKTOP-F1F2RV1
name: users/andrewcbuensalida@gmail.com/sshPublicKeys/064d7f4f330ea19f2ad6d36d214d5c6f463053881935484a6ca8d7e4a09c493e
cant figure it out.

now trying this https://www.youtube.com/watch?v=JAnB7KyDtH4&t=607s
create firewall to allow 3300, then create vm, then open cloud shell and gcloud compute ssh doctor-google --zone us-west2-a
apt install update, then apt install upgrade, then sudo apt install nodejs, sudo apt install npm
now trying this https://www.youtube.com/watch?v=etGPTjEW1Y0
to generate key, in cloud shell, ssh-keygen -t ed25519 -C "andrewcbuensalida@gmail.com"
then cat the ed25519 and copy whats inside
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAq8VNa008ZkZjL2ID6x9VaA3kFDzXrebK3NFdZyLa6Y andrewcbuensalida@gmail.com
but trying ssh-keygen, both pem style and not. then openb powershell so can cat whats inside the pub. then on gcp create new key and paste stuff from the pub.

this method works. create pem with ssh-keygen -m PEM
open powershell and cat the newly created pub file. copy, then create a new file called authorized_keys in .ssh folder in the vm. paste it in there. now can log in with
ssh -i C:\swe\doctorg\doctorg\compute-engine-ssh\doc.pem andrewcbuensalida_gmail_com@34.102.120.157
this method might be better though because he didnt have to manually create the authorized_keys file https://www.youtube.com/watch?v=8QGpHQ2SyG8

now connecting a domain name to ip address.
aws route 53 record can actually point to the ip address on compute engine.
to enable https
sudo nano /etc/nginx/sites-available/docg.anhonestobserver.com.conf
server {

    server_name docg.anhonestobserver.com www.docg.anhonestobserver.com;

    location / {
    proxy_pass http://localhost:3300;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    }

}
sudo systemctl reload nginx
install certbot sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx

had to config user.name and user.email for git in order to push from vm. git config --global user.name "andrewcbuensalida"
git config --global user.email "andrewcbuensalida@gmail.com"